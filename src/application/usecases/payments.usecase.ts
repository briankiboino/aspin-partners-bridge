import { Injectable, Inject } from '@nestjs/common';
import { PaymentsUseCase } from '../interfaces/payments.usecases.interface';
import { QueueService } from '../interfaces/queue.interface';
import {
  InitiatePaymentPayload,
  PaymentHubWebhookPayload,
} from '../dto/payments/input';
import { PaymentNotificationResponse } from '../dto/payments/output';
import { PaymentChannel } from 'src/shared/constants/payments';
import {
  TransactionNotFoundException,
  UnsupportedPaymentChannelException,
} from 'src/shared/exceptions/payment.exceptions';
import { MPesaGateway } from '../interfaces/mpesa.gateway.interface';
import { AirtelGateway } from '../interfaces/airtel.gateway.interface';
import { PaymentRepository } from 'src/domain/repositories/payments.postgres.repository';
import { JobTYPE } from 'src/shared/constants/queue';

@Injectable()
export class PaymentsUseCaseImpl implements PaymentsUseCase {
  constructor(
    @Inject('PaymentRepository')
    private readonly paymentRepository: PaymentRepository,
    @Inject('QueueService')
    private readonly queueService: QueueService,
    @Inject('MPesaGateway')
    private readonly mpesaGateway: MPesaGateway,
    @Inject('AirtelGateway')
    private readonly airtelGateway: AirtelGateway,
  ) {}

  async initiatePayment(payload: InitiatePaymentPayload): Promise<void> {
    return this.queueService.enqueueWebhook(JobTYPE.PAYMENTS, payload);
  }

  async handleWebhook(payload: PaymentHubWebhookPayload): Promise<void> {
    return this.queueService.enqueueWebhook(
      JobTYPE.PAYMENT_NOTIFICATION,
      payload,
    );
  }

  async checkPayment(
    transactionId: string,
    channel: PaymentChannel,
  ): Promise<PaymentNotificationResponse> {
    const transaction = await this.paymentRepository.findByTransactionId(
      transactionId,
    );
    if (!transaction) {
      throw new TransactionNotFoundException(transactionId);
    }

    if (channel === PaymentChannel.MPESA) {
      return this.mpesaGateway.checkStatus(
        transactionId,
        transaction.partner_id,
      );
    } else if (channel === PaymentChannel.AIRTEL) {
      return this.airtelGateway.checkStatus(
        transactionId,
        transaction.partner_id,
      );
    } else {
      throw new UnsupportedPaymentChannelException(channel);
    }
  }
}
