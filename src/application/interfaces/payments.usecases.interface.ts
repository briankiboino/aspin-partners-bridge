import {
  InitiatePaymentPayload,
  PaymentHubWebhookPayload,
} from '../dto/payments/input';
import {
  PaymentNotificationResponse,
  InitiatePaymentResponse,
  WebhookProcessingResponse,
} from '../dto/payments/output';

export interface PaymentsUseCase {
  initiatePayment(
    payload: InitiatePaymentPayload,
  ): Promise<InitiatePaymentResponse>;
  handleWebhook(
    payload: PaymentHubWebhookPayload,
  ): Promise<WebhookProcessingResponse>;
  checkPayment(transactionId: string): Promise<PaymentNotificationResponse>;
}
