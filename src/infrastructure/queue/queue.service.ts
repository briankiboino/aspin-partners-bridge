import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueService } from '../../application/interfaces/queue.interface';
import {
  InitiatePaymentPayload,
  PaymentHubWebhookPayload,
} from '../../application/dto/payments/input';
import { JobTYPE } from 'src/shared/constants/queue';

@Injectable()
export class QueueServiceImpl implements QueueService {
  constructor(@InjectQueue('payments') private readonly paymentsQueue: Queue) {}

  async enqueueWebhook(
    job: JobTYPE,
    payload: PaymentHubWebhookPayload | InitiatePaymentPayload,
  ): Promise<void> {
    await this.paymentsQueue.add(job, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
    });
  }
}
