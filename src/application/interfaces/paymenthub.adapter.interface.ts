import { CheckPaymentPayload } from '../dto/payments/input';
import { InitiatePaymentPayload } from '../dto/payments/input';
import {
  PaymentInitiationResponse,
  PaymentNotificationResponse,
} from '../dto/payments/output';

export interface PaymentHubAdapter {
  initiatePayment(
    payload: InitiatePaymentPayload,
  ): Promise<PaymentInitiationResponse>;
  checkPayment(
    payload: CheckPaymentPayload,
  ): Promise<PaymentNotificationResponse>;
}
