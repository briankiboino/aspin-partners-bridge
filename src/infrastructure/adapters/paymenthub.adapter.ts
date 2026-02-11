import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import {
  InitiatePaymentPayload,
  PaymentHubWebhookPayload,
} from '../../application/dto/input/payments';
import { PaymentHubResponse } from '../../application/dto/output/payments';
import { PaymentHubException } from '../../shared/exceptions/payment.exceptions';

type HTTPRequestConfig = {
  path: string;
  payload?: any;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT';
  authToken?: string;
};

@Injectable()
export class PaymentHubAdapterImpl {
  private readonly logger = new Logger(PaymentHubAdapter.name);
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
  ): Promise<PaymentHubResponse> {
    const response: PaymentHubResponse = await this.makeHttpRequest({
      path: 'payments/initiate',
      method: 'POST',
      payload,
    });

    if (!response?.transaction_id || !response?.status) {
      throw new PaymentHubException('Invalid response from PaymentHub');
    }

    return response;
  }

  async handleWebhook(
    payload: PaymentHubWebhookPayload,
  ): Promise<PaymentHubResponse> {
    if (!payload?.transaction_id || !payload?.status) {
      throw new PaymentHubException('Invalid webhook payload');
    }

    return {
      transaction_id: payload.transaction_id,
      status: payload.status,
      amount: payload.amount,
      currency: payload.currency,
      timestamp: payload.timestamp,
    };
  }

  async checkPayment(transactionId: string): Promise<PaymentHubResponse> {
    const response: PaymentHubResponse = await this.makeHttpRequest({
      path: `payments/${transactionId}/status`,
      method: 'GET',
    });

    if (!response?.transaction_id) {
      throw new PaymentHubException('Payment not found');
    }

    return response;
  }
}
