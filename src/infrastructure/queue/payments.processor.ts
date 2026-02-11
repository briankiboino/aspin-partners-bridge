import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PaymentRepository } from '../repositories/payments.repository.pg';
import { PaymentRepositoryRedis } from '../repositories/payments.repository.redis';
import { PaymentHubAdapter } from '../adapters/paymenthub.adapter';
import { AspinAdapter } from '../adapters/aspin.adapter';
import { Payment } from '../entities/payments.entity';

@Processor('payments')
@Injectable()
export class PaymentsProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentsProcessor.name);

  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly cacheRepo: PaymentRepositoryRedis,
    private readonly paymentHub: PaymentHubAdapter,
    private readonly aspinAdapter: AspinAdapter,
  ) {
    super();
  }

  async process(job: Job<{ payment: Payment }>) {
    const { payment } = job.data;

    this.logger.log(`Processing payment job: ${payment.transactionId}`);

    const alreadyProcessed = await this.cacheRepo.isProcessed(
      payment.transactionId,
    );
    if (alreadyProcessed) {
      this.logger.warn(`Duplicate job ignored: ${payment.transactionId}`);
      return;
    }

    try {
      const paymentResult = await this.paymentHub.initiatePayment({
        customerId: payment.customerId,
        amount: Number(payment.amount),
        currency: payment.currency,
        gateway: payment.gateway as 'airtel' | 'mpesa',
      });

      await this.paymentRepo.save(paymentResult);

      await this.cacheRepo.markProcessed(payment.transactionId);

      await this.aspinAdapter.notifyPaymentStatus(paymentResult);

      this.logger.log(`Payment job completed: ${payment.transactionId}`);
    } catch (err: any) {
      this.logger.error(
        `Payment job failed for ${payment.transactionId}: ${err.message}`,
      );
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed: ${err.message}`);
  }
}
