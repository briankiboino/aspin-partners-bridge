import { PaymentChannel } from 'src/shared/constants/payments';
import {
  PaymentCallbackResponse,
  PaymentInitiationPayload,
  PaymentInitiationResponse,
  PaymentStatusResponse,
} from '../dto/payments/executor.dto';
import { IAirtelChannel, IMpesaChannel } from './channel.interface';

export interface IPaymentExecutor {
  getPartner(): string;
  getChannel(): PaymentChannel;
  getChannelImplementation(): IMpesaChannel | IAirtelChannel;
  initiate(
    payload: PaymentInitiationPayload,
  ): Promise<PaymentInitiationResponse>;
  statusCheck(transactionId: string): Promise<PaymentStatusResponse>;
  handleCallback(payload: any): Promise<PaymentCallbackResponse>;
}
