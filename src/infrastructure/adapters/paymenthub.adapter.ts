import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import {
  CheckPaymentPayload,
  InitiatePaymentPayload,
} from '../../application/dto/payments/input';
import {
  PaymentInitiationResponse,
  PaymentNotificationResponse,
} from '../../application/dto/payments/output';
import { PaymentHubException } from '../../shared/exceptions/payment.exceptions';
import { PaymentHubAdapter } from '../../application/interfaces/paymenthub.adapter.interface';

type HTTPRequestConfig = {
  path: string;
  payload?: any;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT';
  authToken?: string;
};

@Injectable()
export class PaymentHubAdapterImpl implements PaymentHubAdapter {
  private readonly logger = new Logger(PaymentHubAdapterImpl.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('PAYMENTHUB_API_BASE_URL');
    this.apiKey = this.configService.get<string>('PAYMENTHUB_API_KEY');
  }

  private async makeHttpRequest(config: HTTPRequestConfig): Promise<any> {
    try {
      const axiosConfig = {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        timeout: 10000,
      };

      const url = `${this.baseUrl}/${config.path}`;

      const request = this.httpService.request({
        method: config.method,
        url,
        data: config.payload,
        ...axiosConfig,
      });

      const response = await firstValueFrom(request);
      return response.data;
    } catch (error) {
      this.logger.error('PaymentHub API call failed', error?.message);
      throw new PaymentHubException(error?.message);
    }
  }

  async initiatePayment(
    payload: InitiatePaymentPayload,
  ): Promise<PaymentInitiationResponse> {
    const response: PaymentInitiationResponse = await this.makeHttpRequest({
      path: 'payments/initiate',
      method: 'POST',
      payload,
    });

    if (!response?.transaction_id || !response?.status) {
      throw new PaymentHubException('Invalid response from PaymentHub');
    }

    return response;
  }

  async checkPayment(
    payload: CheckPaymentPayload,
  ): Promise<PaymentNotificationResponse> {
    const response: PaymentNotificationResponse = await this.makeHttpRequest({
      path: `payments/${payload.transactionId}/status`,
      method: 'GET',
    });

    if (!response?.transaction_id) {
      throw new PaymentHubException('Payment not found');
    }
    return response;
  }
}
