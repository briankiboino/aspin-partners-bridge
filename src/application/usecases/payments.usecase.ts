import { Injectable, Inject } from '@nestjs/common';
import { PaymentsUseCase } from '../interfaces/payments.usecases.interface';
import {
  InitiatePaymentPayload,
  PaymentHubWebhookPayload,
} from '../dto/payments/input';
import {
  PaymentNotificationResponse,
  InitiatePaymentResponse,
  WebhookProcessingResponse,
} from '../dto/payments/output';
import {
  PaymentChannel,
  PaymentNotificationStatus,
} from 'src/shared/constants/payments';
import { TransactionNotFoundException } from 'src/shared/exceptions/payment.exceptions';
import { PaymentRepository } from 'src/domain/repositories/payments.postgres.repository';
import { PaymentExecutorBuilder } from 'src/infrastructure/executors/builder/payment.executor.builder';
import { determineChannelFromPayload } from 'src/shared/utils/helpers';

@Injectable()
export class PaymentsUseCaseImpl implements PaymentsUseCase {
  constructor(
    @Inject('PaymentRepository')
    private readonly paymentRepository: PaymentRepository,
    @Inject('PaymentExecutorBuilder')
    private readonly executorFactory: PaymentExecutorBuilder,
  ) {}

  async initiatePayment(
    payload: InitiatePaymentPayload,
  ): Promise<InitiatePaymentResponse> {
    const executor = this.executorFactory.getExecutor(
      payload.partner_id,
      payload.channel,
    );

    const result = await executor.initiate({
      amount: payload.amount,
      currency: payload.currency,
      customerId: payload.customer_id,
      phoneNumber: payload.phoneNumber,
      reference: payload.reference,
      partnerId: payload.partner_id,
      channel: payload.channel,
    });

    return {
      success: true,
      data: {
        transaction_id: result.transactionId,
        status: result.status,
        amount: result.amount,
        currency: result.currency,
        timestamp: result.timestamp,
      },
    };
  }

  async handleWebhook(
    payload: PaymentHubWebhookPayload,
  ): Promise<WebhookProcessingResponse> {
    const channel = determineChannelFromPayload(payload);

    const executor = this.executorFactory.getExecutor(
      payload.partner_id.toUpperCase(),
      channel,
    );

    const result = await executor.handleCallback(payload);

    return {
      transaction_id: result.transactionId,
      status: result.status,
      processed: true,
    };
  }

  async checkPayment(
    transactionId: string,
  ): Promise<PaymentNotificationResponse> {
    const transaction = await this.paymentRepository.findByTransactionId(
      transactionId,
    );
    if (!transaction) {
      throw new TransactionNotFoundException(transactionId);
    }

    const executor = this.executorFactory.getExecutor(
      transaction.partner_id,
      transaction.channel as PaymentChannel,
    );

    const result = await executor.statusCheck(transactionId);

    return {
      transaction_id: result.transactionId,
      status: result.status as PaymentNotificationStatus,
      amount: result.amount || transaction.amount,
      currency: result.currency || transaction.currency,
      timestamp: result.timestamp.toISOString(),
      signature: '',
    };
  }
}
