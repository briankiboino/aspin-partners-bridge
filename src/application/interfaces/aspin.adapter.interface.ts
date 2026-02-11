import { PaymentNotificationResponse } from '../dto/payments/output';

export interface AspinAdapter {
  notifyPaymentStatus(payload: PaymentNotificationResponse): Promise<void>;
}
