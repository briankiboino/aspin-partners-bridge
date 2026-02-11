import {
  Controller,
  Res,
  UseGuards,
  HttpStatus,
  UseFilters,
  Inject,
  Body,
  Post,
  Get,
  Param,
} from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { Response } from 'express';
import { buildResponse } from '../../shared/utils/helpers';
import { ApiKeyGuard } from '../guards/api.key.guard';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { ValidationFilter } from '../filters/validation.filter';
import { PaymentsUseCase } from '../../application/interfaces/payments.usecases.interface';
import {
  InitiatePaymentDto,
  PaymentHubWebhookDto,
  InitiatePaymentPayload,
  PaymentHubWebhookPayload,
} from '../../application/dto/payments/input';

@Controller('api/v1/user/payments')
@UseGuards(ApiKeyGuard, AuthenticationGuard)
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
        reference: dto.reference,
        metadata: dto.metadata,
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
  async handleWebhook(@Res() res: Response, @Body() dto: PaymentHubWebhookDto) {
    try {
      const payload: PaymentHubWebhookPayload = {
        transaction_id: dto.transaction_id,
        status: dto.status,
        reference: dto.reference,
        metadata: dto.metadata,
      };

      const data = await this.paymentsUseCase.handleWebhook(payload);

      return buildResponse(
        res,
        HttpStatus.OK,
        true,
        'Webhook processed successfully',
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

  @Get('/:transactionId')
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
