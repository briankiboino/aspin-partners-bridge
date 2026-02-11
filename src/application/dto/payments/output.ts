import { PaymentNotificationStatus } from 'src/shared/constants/payments';

export interface PaymentInitiationResponse {
  transaction_id: string;
  status: PaymentNotificationStatus;
  message: string;
  data?: any;
}

export interface PaymentNotificationResponse {
  transaction_id: string;
  status: PaymentNotificationStatus;
  amount: number;
  currency: string;
  timestamp: string;
  signature: string;
}
