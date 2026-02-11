import {
  InitiatePaymentPayload,
  PaymentHubWebhookPayload,
} from '../dto/payments/input';
import { PaymentHubResponse } from '../dto/payments/output';

export interface PaymentsUseCase {
  initiatePayment(payload: InitiatePaymentPayload): Promise<PaymentHubResponse>;
  handleWebhook(payload: PaymentHubWebhookPayload): Promise<PaymentHubResponse>;
  checkPayment(transactionId: string): Promise<PaymentHubResponse>;
}
