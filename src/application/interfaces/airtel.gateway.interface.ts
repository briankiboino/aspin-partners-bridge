import { PaymentGateway } from './payment.gateway.interface';

export interface AirtelGateway extends PaymentGateway {
  loadConfig(partnerId: string): Promise<Record<string, any>>;
  initiatePayment(payload: any): Promise<any>;
  checkStatus(transactionId: string, partnerId: string): Promise<any>;
}
