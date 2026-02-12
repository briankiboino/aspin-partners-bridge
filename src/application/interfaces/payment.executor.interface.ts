import { PaymentChannel } from 'src/shared/constants/payments';
import {
  PaymentCallbackResponse,
  PaymentInitiationPayload,
  PaymentInitiationResponse,
  PaymentStatusResponse,
} from '../dto/payments/executor.dto';

export interface IPaymentExecutor {
  getPartner(): string;
  getChannel(): PaymentChannel;
  initiate(
    payload: PaymentInitiationPayload,
  ): Promise<PaymentInitiationResponse>;
  statusCheck(transactionId: string): Promise<PaymentStatusResponse>;
  handleCallback(payload: any): Promise<PaymentCallbackResponse>;
}
