import { Logger, Inject } from '@nestjs/common';
import {
  PaymentCallbackResponse,
  PaymentInitiationPayload,
  PaymentInitiationResponse,
  PaymentStatusResponse,
} from '../../application/dto/payments/executor.dto';
import { IPaymentExecutor } from '../../application/interfaces/payment.executor.interface';
import {
  PaymentChannel,
  PaymentNotificationStatus,
} from '../../shared/constants/payments';
import {
  IMpesaChannel,
  IAirtelChannel,
} from '../../application/interfaces/channel.interface';
import { PaymentRepository } from '../../domain/repositories/payments.postgres.repository';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { QueueService } from '../../application/interfaces/queue.interface';
import { PaymentRepositoryImpl } from '../repositories/payments.postgres.repository';
import { AspinAdapter } from '../../application/interfaces/aspin.adapter.interface';
import { PaymentNotificationResponse } from '../../application/dto/payments/output';
import { MetricsService } from '../monitoring/metrics.service';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

export abstract class BasePaymentExecutor implements IPaymentExecutor {
  protected readonly logger = new Logger(this.constructor.name);
  private aspinAdapterSignatureSecret: string;

  constructor(
    @Inject(PaymentRepositoryImpl)
    protected readonly paymentRepository: PaymentRepository,
    @Inject('QueueService')
    protected readonly queueService: QueueService,
    @Inject(RabbitMQService)
    protected readonly rabbitmqService: RabbitMQService,
    @Inject('AspinAdapter')
    protected readonly aspinAdapter: AspinAdapter,
    protected readonly metricsService: MetricsService,
    private configService: ConfigService,
  ) {
    this.aspinAdapterSignatureSecret = configService.get<string>(
      'ASPIN_ADAPTER_SIGNATURE_SECRET',
    );
  }

  abstract getPartner(): string;
  abstract getChannel(): PaymentChannel;
  protected abstract getChannelImplementation(): IMpesaChannel | IAirtelChannel;

  async initiate(
    payload: PaymentInitiationPayload,
  ): Promise<PaymentInitiationResponse> {
    this.metricsService.incrementPaymentInitiated(
      payload.partnerId,
      this.getChannel(),
    );
    this.logger.log(
      `Initiating payment for partner ${this.getPartner()} via ${this.getChannel()}`,
    );

    try {
      const existing = await this.paymentRepository.findByReference(
        payload.reference,
      );
      if (existing) {
        throw new Error(`Duplicate transaction attempt: ${payload.reference}`);
      }

      let channelResponse;

      try {
        this.metricsService.incrementApiCall(
          payload.partnerId,
          this.getChannel(),
        );

        if (this.getChannel() === PaymentChannel.MPESA) {
          const mpesaChannel = this.getChannelImplementation() as IMpesaChannel;
          channelResponse = await mpesaChannel.stkPush({
            phoneNumber: payload.customerId,
            amount: payload.amount,
            accountReference: payload.reference,
            transactionDesc: `Payment for ${this.getPartner()}`,
            partnerId: payload.partnerId,
          });
        } else if (this.getChannel() === PaymentChannel.AIRTEL) {
          const airtelChannel =
            this.getChannelImplementation() as IAirtelChannel;
          channelResponse = await airtelChannel.directDebit({
            phoneNumber: payload.customerId,
            amount: payload.amount,
            reference: payload.reference,
            partnerId: payload.partnerId,
          });
        }
      } catch (error) {
        if (error.response) {
          const status = error.response.status;
          if (status >= 400 && status < 500) {
            this.metricsService.incrementApiError4xx(
              payload.partnerId,
              this.getChannel(),
              status,
            );
          } else if (status >= 500) {
            this.metricsService.incrementApiError5xx(
              payload.partnerId,
              this.getChannel(),
              status,
            );
          }
        } else if (error.code === 'ECONNREFUSED') {
          this.metricsService.incrementConnectionRefused(
            payload.partnerId,
            this.getChannel(),
          );
        } else if (error.code === 'ETIMEDOUT') {
          this.metricsService.incrementApiTimeout(
            payload.partnerId,
            this.getChannel(),
          );
        }
        throw error;
      }

      const transactionId =
        channelResponse?.transactionId ||
        this.generateTransactionId(this.getPartner(), this.getChannel());

      await this.paymentRepository.create({
        transactionId,
        partner_id: payload.partnerId,
        channel: this.getChannel(),
        customerId: payload.customerId,
        amount: payload.amount,
        currency: payload.currency,
        status: 'pending',
        reference: payload.reference,
        gateway: this.getChannel(),
        processed: false,
      });

      await this.queueService.addStatusCheckJob(
        {
          transactionId,
          partnerId: payload.partnerId,
          channel: this.getChannel(),
        },
        {
          delay: 5000,
        },
      );

      const response: PaymentInitiationResponse = {
        transactionId,
        status: channelResponse?.status || 'pending',
        amount: payload.amount,
        currency: payload.currency,
        timestamp: channelResponse?.timestamp
          ? new Date(channelResponse.timestamp)
          : new Date(),
        channelResponse,
      };

      return response;
    } catch (error) {
      this.logger.error(
        `Payment initiation failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async statusCheck(transactionId: string): Promise<PaymentStatusResponse> {
    this.logger.log(`Checking status for transaction: ${transactionId}`);

    try {
      const payment = await this.paymentRepository.findByTransactionId(
        transactionId,
      );
      if (!payment) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }

      const channel = this.getChannelImplementation();
      const statusResponse = await channel.queryTransaction(transactionId);

      let status: string;
      if ('status' in statusResponse) {
        status = statusResponse.status;
      } else {
        this.logger.error('Unknown status response format', statusResponse);
        throw new Error('Unknown status response format');
      }

      if (status !== payment.status) {
        await this.paymentRepository.updateStatus(transactionId, status);

        if (['completed', 'failed'].includes(status)) {
          await this.publishPaymentResult(payment, status);
        }
      }

      return {
        transactionId,
        status,
        amount: payment.amount,
        currency: payment.currency,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Status check failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async handleCallback(payload: any): Promise<PaymentCallbackResponse> {
    this.logger.log(`Handling callback for partner ${this.getPartner()}`);

    try {
      const transactionId = this.extractTransactionId(payload);

      const payment = await this.paymentRepository.findByTransactionId(
        transactionId,
      );
      if (!payment) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }

      this.metricsService.incrementWebhookReceived(payment.partner_id);

      if (payment.processed) {
        this.logger.warn(
          `Duplicate callback for transaction: ${transactionId}`,
        );
        return {
          transactionId,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          timestamp: new Date(payment.updatedAt),
          isValid: true,
        };
      }

      const config = await this.getChannelImplementation().loadConfig(
        this.getPartner(),
      );
      const isValid = this.getChannelImplementation().validateCallback(
        payload,
        config.config.webhookSecret,
      );

      if (!isValid) {
        throw new Error('Invalid callback signature');
      }

      const status = this.extractStatusFromCallback(payload);

      await this.paymentRepository.update(transactionId, {
        status,
        processed: true,
      });

      await this.publishPaymentResult(payment, status);

      this.metricsService.incrementWebhookProcessed(payment.partner_id, status);

      if (status === 'completed') {
        this.metricsService.incrementPaymentSuccess(
          payment.partner_id,
          payment.channel as string,
        );
        const duration =
          (new Date().getTime() - payment.createdAt.getTime()) / 1000;
        this.metricsService.recordPaymentDuration(
          payment.partner_id,
          payment.channel as string,
          status,
          duration,
        );
      }

      return {
        transactionId,
        status,
        amount: payment.amount,
        currency: payment.currency,
        timestamp: new Date(),
        isValid: true,
      };
    } catch (error) {
      this.metricsService.incrementWebhookFailed(
        this.getPartner(),
        error.message || 'unknown',
      );
      this.logger.error(
        `Callback handling failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  protected generateTransactionId(
    partner: string,
    channel: PaymentChannel,
  ): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${channel}_${partner}_${timestamp}_${random}`;
  }

  protected extractTransactionId(payload: any): string {
    return (
      payload.transaction_id || payload.transactionId || payload.TransactionID
    );
  }

  protected extractStatusFromCallback(payload: any): string {
    const status = payload.status || payload.Status || payload.ResultCode;

    if (status === '0' || status === 'completed' || status === 'SUCCESS') {
      return 'completed';
    } else if (status === 'failed' || status === 'FAILED') {
      return 'failed';
    }

    return 'pending';
  }

  protected async publishPaymentResult(
    payment: any,
    status: string,
  ): Promise<void> {
    const event = {
      transaction_id: payment.transactionId,
      partner_id: payment.partner_id,
      channel: payment.channel,
      amount: payment.amount,
      currency: payment.currency,
      status,
      timestamp: new Date().toISOString(),
      customer_id: payment.customerId,
      reference: payment.reference,
    };

    if (status === 'completed') {
      await this.rabbitmqService.publishPaymentCompleted(event);
    } else if (status === 'failed') {
      await this.rabbitmqService.publishPaymentFailed(event);
    } else {
      await this.rabbitmqService.publishPaymentPending(event);
    }

    this.logger.log(
      `Published payment result to RabbitMQ for ${payment.partner_id}`,
    );

    try {
      const aspinStatus =
        status === 'completed'
          ? PaymentNotificationStatus.SUCCESS
          : PaymentNotificationStatus.FAILED;

      const aspinPayload: PaymentNotificationResponse = {
        transaction_id: payment.transactionId,
        status: aspinStatus,
        amount: payment.amount,
        currency: payment.currency,
        timestamp: event.timestamp,
        signature: crypto
          .createHmac('sha256', this.aspinAdapterSignatureSecret)
          .update(payment.transactionId + status)
          .digest('hex'),
      };

      await this.aspinAdapter.notifyPaymentStatus(aspinPayload);
      this.logger.log(
        `Notified Aspin of payment status: ${payment.transactionId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to notify Aspin: ${error.message}`);
    }
  }
}
