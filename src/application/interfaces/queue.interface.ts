import { JobTYPE } from 'src/shared/constants/queue';
import {
  InitiatePaymentPayload,
  PaymentHubWebhookPayload,
} from '../dto/payments/input';

export interface QueueService {
  enqueueWebhook(
    job: JobTYPE,
    payload: PaymentHubWebhookPayload | InitiatePaymentPayload,
  ): Promise<void>;
}
