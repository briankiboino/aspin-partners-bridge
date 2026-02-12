import { PaymentChannel } from 'src/shared/constants/payments';
import {
  AirtelDirectDebitPayload,
  AirtelDirectDebitResponse,
  AirtelQueryResponse,
  MpesaQueryResponse,
  MpesaStkPushPayload,
  MpesaStkPushResponse,
} from '../dto/payments/channel.dto';

export interface IBaseChannel {
  getChannelType(): PaymentChannel;
  loadConfig(partnerId: string): Promise<ChannelConfiguration>;
  validateConfig(config: ChannelConfiguration): boolean;
}

export interface ChannelConfiguration {
  partnerId: string;
  channel: PaymentChannel;
  config: Record<string, any>;
}

export interface IMpesaChannel extends IBaseChannel {
  stkPush(payload: MpesaStkPushPayload): Promise<MpesaStkPushResponse>;
  queryTransaction(transactionId: string): Promise<MpesaQueryResponse>;
  validateCallback(payload: any, secret: string): boolean;
}

export interface IAirtelChannel extends IBaseChannel {
  directDebit(
    payload: AirtelDirectDebitPayload,
  ): Promise<AirtelDirectDebitResponse>;
  queryTransaction(transactionId: string): Promise<AirtelQueryResponse>;
  validateCallback(payload: any, secret: string): boolean;
}
