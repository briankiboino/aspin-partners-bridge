import { PaymentChannel } from 'src/shared/constants/payments';
import {
  InitiatePaymentPayload,
  PaymentHubWebhookPayload,
} from '../dto/payments/input';
import { PaymentNotificationResponse } from '../dto/payments/output';

export interface PaymentsUseCase {
  initiatePayment(payload: InitiatePaymentPayload): Promise<void>;
  handleWebhook(payload: PaymentHubWebhookPayload): Promise<void>;
  checkPayment(
    transactionId: string,
    channel: PaymentChannel,
  ): Promise<PaymentNotificationResponse>;
}
