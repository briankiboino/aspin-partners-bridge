import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsObject,
} from 'class-validator';

export interface InitiatePaymentPayload {
  amount: number;
  currency: string;
  customer_id: string;
  reference: string;
  metadata?: Record<string, any>;
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

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  constructor(partial: Partial<InitiatePaymentDto>) {
    Object.assign(this, partial);
  }
}

export interface PaymentHubWebhookPayload {
  transaction_id: string;
  status: string;
  reference: string;
  metadata?: Record<string, any>;
}

export class PaymentHubWebhookDto {
  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  constructor(partial: Partial<PaymentHubWebhookDto>) {
    Object.assign(this, partial);
  }
}
