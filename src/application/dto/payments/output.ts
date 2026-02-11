export interface PaymentHubResponse {
  transaction_id: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  message: string;
  data?: any;
}
