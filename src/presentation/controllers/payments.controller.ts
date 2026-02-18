import {
  Controller,
  Res,
  HttpStatus,
  UseFilters,
  Inject,
  Body,
  Post,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { Response } from 'express';
import { buildResponse } from '../../shared/utils/helpers';
import { ValidationFilter } from '../filters/validation.filter';
import { PaymentsUseCase } from '../../application/interfaces/payments.usecases.interface';
import {
  InitiatePaymentDto,
  PaymentHubWebhookDto,
  InitiatePaymentPayload,
  PaymentHubWebhookPayload,
} from '../../application/dto/payments/input';
import { PaymentNotificationStatus } from 'src/shared/constants/payments';

@Controller('api/v1/user/payments')
@UseFilters(ValidationFilter)
export class PaymentsController {
  constructor(
    @Inject('PaymentsUseCase')
    private readonly paymentsUseCase: PaymentsUseCase,
  ) {}

  @Post('/initiate')
  async initiatePayment(@Res() res: Response, @Body() dto: InitiatePaymentDto) {
    try {
      const payload: InitiatePaymentPayload = {
        amount: dto.amount,
        currency: dto.currency,
        customer_id: dto.customer_id,
        phoneNumber: dto.phoneNumber,
        reference: dto.reference,
        channel: dto.channel,
        partner_id: dto.partner_id,
      };

      const data = await this.paymentsUseCase.initiatePayment(payload);

      return buildResponse(
        res,
        HttpStatus.OK,
        true,
        'Successfully initiated payment',
        null,
        instanceToPlain(data),
      );
    } catch (err) {
      return buildResponse(
        res,
        err?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
        false,
        err?.message || 'Internal Server Error',
        err,
        null,
      );
    }
  }

  @Post('/webhook')
  async handleWebhook(
    @Res() res: Response,
    @Body() dto: PaymentHubWebhookDto,
    @Query('partnerId') partnerId: string,
  ) {
    try {
      const payload: PaymentHubWebhookPayload = {
        transaction_id: dto.transaction_id,
        status: dto.status as PaymentNotificationStatus,
        partner_id: partnerId,
        amount: dto.amount,
        currency: dto.currency,
        timestamp: dto.timestamp,
        signature: dto.signature,
      };

      const data = await this.paymentsUseCase.handleWebhook(payload);

      return buildResponse(
        res,
        HttpStatus.OK,
        true,
        'Payment notification processed successfully',
        null,
        instanceToPlain(data),
      );
    } catch (err) {
      return buildResponse(
        res,
        err?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
        false,
        err?.message || 'Internal Server Error',
        err,
        null,
      );
    }
  }

  @Get('/:transactionId/:channel')
  async checkPayment(
    @Res() res: Response,
    @Param('transactionId') transactionId: string,
  ) {
    try {
      const data = await this.paymentsUseCase.checkPayment(transactionId);

      return buildResponse(
        res,
        data ? HttpStatus.OK : HttpStatus.NOT_FOUND,
        !!data,
        data ? 'Successfully checked payment status' : 'Payment not found',
        null,
        instanceToPlain(data),
      );
    } catch (err) {
      return buildResponse(
        res,
        err?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
        false,
        err?.message || 'Internal Server Error',
        err,
        null,
      );
    }
  }
}
