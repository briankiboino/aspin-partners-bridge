import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import {
  PaymentChannel,
  PaymentNotificationStatus,
} from 'src/shared/constants/payments';

export interface InitiatePaymentPayload {
  amount: number;
  currency: string;
  customer_id: string;
  reference: string;
  partner_id: string;
  channel: PaymentChannel;
  transactionId?: string;
  metadata?: Record<string, any>;
  config?: any;
}

export class InitiatePaymentDto {
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  customer_id: string;

  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsString()
  @IsNotEmpty()
  partner_id: string;

  @IsString()
  @IsNotEmpty()
  channel: PaymentChannel;

  constructor(partial: Partial<InitiatePaymentDto>) {
    Object.assign(this, partial);
  }
}

export interface PaymentHubWebhookPayload {
  transaction_id: string;
  status: PaymentNotificationStatus;
  amount: number;
  currency: string;
  timestamp: string;
  signature: string;
  partner_id: string;
}

export class PaymentHubWebhookDto {
  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @IsString()
  @IsNotEmpty()
  signature: string;

  constructor(partial: Partial<PaymentHubWebhookDto>) {
    Object.assign(this, partial);
  }
}

export interface CheckPaymentPayload {
  transactionId: string;
  partnerId: string;
  channel: PaymentChannel;
  config?: any;
}
