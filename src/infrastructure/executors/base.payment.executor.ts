import { Logger, Inject, forwardRef } from '@nestjs/common';
import {
  PaymentCallbackResponse,
  PaymentInitiationPayload,
  PaymentInitiationResponse,
  PaymentStatusResponse,
} from 'src/application/dto/payments/executor.dto';
import { IPaymentExecutor } from 'src/application/interfaces/payment.executor.interface';
import { PaymentChannel } from 'src/shared/constants/payments';
import {
  IMpesaChannel,
  IAirtelChannel,
} from 'src/application/interfaces/channel.interface';
import { PaymentRepository } from 'src/domain/repositories/payments.postgres.repository';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { QueueService } from 'src/application/interfaces/queue.interface';
import { PaymentRepositoryImpl } from '../repositories/payments.postgres.repository';
import { QueueServiceImpl } from '../queue/queue.service.impl';

export abstract class BasePaymentExecutor implements IPaymentExecutor {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    @Inject(PaymentRepositoryImpl)
    protected readonly paymentRepository: PaymentRepository,
    @Inject(forwardRef(() => QueueServiceImpl))
    protected readonly queueService: QueueService,
    protected readonly rabbitmqService: RabbitMQService,
  ) {}

  abstract getPartner(): string;
  abstract getChannel(): PaymentChannel;
  protected abstract getChannelImplementation(): IMpesaChannel | IAirtelChannel;

  async initiate(
    payload: PaymentInitiationPayload,
  ): Promise<PaymentInitiationResponse> {
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
        const airtelChannel = this.getChannelImplementation() as IAirtelChannel;
        channelResponse = await airtelChannel.directDebit({
          phoneNumber: payload.customerId,
          amount: payload.amount,
          reference: payload.reference,
          partnerId: payload.partnerId,
        });
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

      return {
        transactionId,
        status,
        amount: payment.amount,
        currency: payment.currency,
        timestamp: new Date(),
        isValid: true,
      };
    } catch (error) {
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

    await this.rabbitmqService.publish(
      'payment.events',
      'payment.completed',
      event,
    );

    this.logger.log(
      `Published payment result to RabbitMQ for ${payment.partner_id}`,
    );
  }
}
