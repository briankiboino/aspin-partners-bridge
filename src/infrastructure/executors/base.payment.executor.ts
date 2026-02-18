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
import {
  DuplicateTransactionAttemptException,
  InvalidCallbackSignatureException,
  TransactionNotFoundException,
  UnknownPaymentStatusException,
} from 'src/shared/exceptions/payment.exceptions';
import { RedisProvider } from '../database/redis.provider';

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
    private readonly redisProvider: RedisProvider,
  ) {
    this.aspinAdapterSignatureSecret = this.configService.get<string>(
      'ASPIN_ADAPTER_SIGNATURE_SECRET',
    );
  }

  abstract getPartner(): string;
  abstract getChannel(): PaymentChannel;
  abstract getChannelImplementation(): IMpesaChannel | IAirtelChannel;

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
        throw new DuplicateTransactionAttemptException(
          `Duplicate transaction attempt: ${payload.reference}`,
        );
      }

      await this.paymentRepository.create({
        partner_id: payload.partnerId,
        channel: this.getChannel(),
        customerId: payload.customerId,
        phoneNumber: payload.customerId,
        amount: payload.amount,
        currency: payload.currency,
        status: 'pending',
        reference: payload.reference,
        gateway: this.getChannel(),
        processed: false,
      });

      await this.queueService.addPaymentInitiationJob(payload.reference, {
        delay: 0,
      });

      const response: PaymentInitiationResponse = {
        status: 'pending',
        amount: payload.amount,
        currency: payload.currency,
        timestamp: new Date(),
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
        throw new TransactionNotFoundException(transactionId);
      }

      const channel = this.getChannelImplementation();
      const statusResponse = await channel.queryTransaction(transactionId);

      let status: string;
      if ('status' in statusResponse) {
        status = statusResponse.status;
      } else {
        this.logger.error('Unknown status response format', statusResponse);
        throw new UnknownPaymentStatusException();
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

      const lockKey = this.buildCallbackLockKey(transactionId);
      const acquired = await this.acquireCallbackLock(lockKey);

      if (!acquired) {
        this.logger.warn(
          `Callback lock not acquired for transaction ${transactionId}`,
        );
        const existingPayment =
          await this.paymentRepository.findByTransactionId(transactionId);
        if (!existingPayment) {
          throw new TransactionNotFoundException(transactionId);
        }
        return {
          transactionId,
          status: existingPayment.status,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          timestamp: new Date(existingPayment.updatedAt),
          isValid: true,
        };
      }

      try {
        const payment = await this.paymentRepository.findByTransactionId(
          transactionId,
        );
        if (!payment) {
          throw new TransactionNotFoundException(transactionId);
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
          throw new InvalidCallbackSignatureException();
        }

        const status = this.extractStatusFromCallback(payload);

        await this.paymentRepository.update(transactionId, {
          status,
          processed: true,
        });

        await this.publishPaymentResult(payment, status);

        this.metricsService.incrementWebhookProcessed(
          payment.partner_id,
          status,
        );

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
      } finally {
        await this.releaseCallbackLock(lockKey);
      }
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

  protected buildCallbackLockKey(transactionId: string): string {
    return `callback:${this.getPartner()}:${transactionId}`;
  }

  protected async acquireCallbackLock(
    key: string,
    ttlSeconds = 30,
  ): Promise<boolean> {
    const client = this.redisProvider.getClient();
    const result = await client.set(key, '1', { NX: true, EX: ttlSeconds });
    return result === 'OK';
  }

  protected async releaseCallbackLock(key: string): Promise<void> {
    const client = this.redisProvider.getClient();
    await client.del(key);
  }
}
