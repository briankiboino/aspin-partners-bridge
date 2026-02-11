import {
  Processor,
  WorkerHost,
  OnWorkerEvent,
  InjectQueue,
} from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  InitiatePaymentPayload,
  PaymentHubWebhookPayload,
  CheckPaymentPayload,
} from '../../application/dto/payments/input';
import { PaymentRepository } from 'src/domain/repositories/payments.postgres.repository';
import { PaymentsCacheRepository } from 'src/domain/repositories/payments.redis.repository';
import {
  PaymentChannel,
  PaymentNotificationStatus,
} from 'src/shared/constants/payments';
import { JobTYPE, QueueTYPE } from 'src/shared/constants/queue';
import { AirtelGateway } from '../gateways/airtel.gateway';
import { MPesaGateway } from '../gateways/mpesa.gateway';
import { UnsupportedPaymentChannelException } from 'src/shared/exceptions/payment.exceptions';

@Processor(QueueTYPE.PAYMENTS)
@Injectable()
export class PaymentsProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentsProcessor.name);

  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly cacheRepo: PaymentsCacheRepository,
    @Inject('MPesaGateway')
    private readonly mpesaGateway: MPesaGateway,
    @Inject('AirtelGateway')
    private readonly airtelGateway: AirtelGateway,
    @InjectQueue(QueueTYPE.PAYMENTS)
    private readonly paymentsQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any>) {
    if (job.name === JobTYPE.PAYMENT_NOTIFICATION) {
      await this.processWebhook(job.data as PaymentHubWebhookPayload);
    } else if (job.name === JobTYPE.PAYMENTS) {
      await this.processPayment(job.data as InitiatePaymentPayload);
    } else if (job.name === JobTYPE.PAYMENT_STATUS_CHECK) {
      await this.processStatusCheck(job.data as CheckPaymentPayload);
    } else {
      throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  private async processWebhook(payload: PaymentHubWebhookPayload) {
    this.logger.log(
      `Processing webhook job for transaction: ${payload.transaction_id}`,
    );
    try {
      await this.paymentRepo.updateStatus(
        payload.transaction_id,
        payload.status as PaymentNotificationStatus,
      );

      this.logger.log(
        `Webhook processed successfully for: ${payload.transaction_id}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Webhook processing failed for ${payload.transaction_id}: ${err.message}`,
      );
      throw err;
    }
  }

  private async processPayment(payload: InitiatePaymentPayload) {
    const txId = payload.transactionId || payload.reference;
    this.logger.log(`Processing payment job: ${txId}`);

    if (txId) {
      const alreadyProcessed = await this.cacheRepo.isProcessed(txId);
      if (alreadyProcessed) {
        this.logger.warn(`Duplicate job ignored: ${txId}`);
        return;
      }
    } else {
      this.logger.warn(
        `Processing payment job without transactionId or reference`,
      );
    }

    try {
      if (payload.channel === PaymentChannel.MPESA) {
        await this.mpesaGateway.initiatePayment(payload);
      } else if (payload.channel === PaymentChannel.AIRTEL) {
        await this.airtelGateway.initiatePayment(payload);
      } else {
        throw new UnsupportedPaymentChannelException(payload.channel);
      }

      if (txId) {
        this.logger.log(`Scheduling status check for ${txId} in 5 seconds`);
        const statusCheckPayload: CheckPaymentPayload = {
          transactionId: txId,
          partnerId: payload.partner_id,
          channel: payload.channel,
        };
        await this.paymentsQueue.add(
          JobTYPE.PAYMENT_STATUS_CHECK,
          statusCheckPayload,
          { delay: 5000 },
        );
      }
    } catch (err: any) {
      this.logger.error(`Payment job failed for ${txId}: ${err.message}`);
      throw err;
    }
  }

  private async processStatusCheck(payload: CheckPaymentPayload) {
    this.logger.log(
      `Processing status check for transaction: ${payload.transactionId}`,
    );
    try {
      let statusResponse;
      if (payload.channel === PaymentChannel.MPESA) {
        statusResponse = await this.mpesaGateway.checkStatus(
          payload.transactionId,
          payload.partnerId,
        );
      } else if (payload.channel === PaymentChannel.AIRTEL) {
        statusResponse = await this.airtelGateway.checkStatus(
          payload.transactionId,
          payload.partnerId,
        );
      } else {
        throw new UnsupportedPaymentChannelException(payload.channel);
      }

      if (statusResponse && statusResponse.status) {
        await this.paymentRepo.updateStatus(
          payload.transactionId,
          statusResponse.status,
        );
        this.logger.log(
          `Status check completed for ${payload.transactionId}. Status: ${statusResponse.status}`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Status check failed for ${payload.transactionId}: ${err.message}`,
      );
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed: ${err.message}`);
  }
}
