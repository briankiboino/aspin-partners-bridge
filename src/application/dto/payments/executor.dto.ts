import { PaymentChannel } from '../../../shared/constants/payments';

export interface PaymentInitiationPayload {
  amount: number;
  currency: string;
  customerId: string;
  reference: string;
  partnerId: string;
  channel: PaymentChannel;
}

export interface PaymentInitiationResponse {
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
  timestamp: Date;
  channelResponse?: any;
}

export interface PaymentStatusResponse {
  transactionId: string;
  status: string;
  amount?: number;
  currency?: string;
  timestamp: Date;
}

export interface PaymentCallbackResponse {
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
  timestamp: Date;
  isValid: boolean;
}
