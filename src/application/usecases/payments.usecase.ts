import { Injectable, Inject } from '@nestjs/common';
import { PaymentsUseCase } from '../interfaces/payments.usecases.interface';
import { PaymentHubAdapter } from '../interfaces/paymenthub.adapter.interface';
import {
  InitiatePaymentPayload,
  PaymentHubWebhookPayload,
} from '../dto/payments/input';
import { PaymentHubResponse } from '../dto/payments/output';

@Injectable()
export class PaymentsUseCaseImpl implements PaymentsUseCase {
  constructor(
    @Inject('PaymentHubAdapter')
    private readonly paymentHubAdapter: PaymentHubAdapter,
  ) {}

  async initiatePayment(
    payload: InitiatePaymentPayload,
  ): Promise<PaymentHubResponse> {
    return this.paymentHubAdapter.initiatePayment(payload);
  }

  async handleWebhook(
    payload: PaymentHubWebhookPayload,
  ): Promise<PaymentHubResponse> {
    return this.paymentHubAdapter.handleWebhook(payload);
  }

  async checkPayment(transactionId: string): Promise<PaymentHubResponse> {
    return this.paymentHubAdapter.checkPayment(transactionId);
  }
}
