import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { PaymentHubException } from '../../shared/exceptions/payment.exceptions';
import { PaymentHubAdapter } from '../../application/interfaces/paymenthub.adapter.interface';

type HTTPRequestConfig = {
  path: string;
  payload?: any;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT';
  authToken?: string;
};

export interface PaymentHubMpesaRequest {
  partnerId: string;
  [key: string]: any;
}

export interface PaymentHubMpesaResponse {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface PaymentHubAirtelRequest {
  partnerId: string;
  [key: string]: any;
}

export interface PaymentHubAirtelResponse {
  transactionId: string;
  status: string;
  message: string;
}

export interface PaymentHubStatusResponse {
  transactionId: string;
  status: string;
  amount?: number;
  currency?: string;
  responseCode?: string;
  responseDescription?: string;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  resultCode?: string;
  resultDesc?: string;
}

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

    // Request interceptor for logging
    this.httpService.axiosRef.interceptors.request.use(
      (config) => {
        this.logger.log(
          `PaymentHub Request: ${config.method?.toUpperCase()} ${config.url}`,
        );
        return config;
      },
      (error) => {
        this.logger.error('PaymentHub Request Error:', error);
        return Promise.reject(error);
      },
    );

    // Response interceptor for logging
    this.httpService.axiosRef.interceptors.response.use(
      (response) => {
        this.logger.log(
          `PaymentHub Response: ${response.status} ${response.config.url}`,
        );
        return response;
      },
      (error) => {
        this.logger.error(
          `PaymentHub Error: ${error.response?.status} ${error.config?.url}`,
          error.response?.data,
        );
        return Promise.reject(error);
      },
    );
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

  async initiateMpesaPayment(
    payload: PaymentHubMpesaRequest,
  ): Promise<PaymentHubMpesaResponse> {
    this.logger.log(
      `Initiating Mpesa payment for partner ${payload.partnerId} via PaymentHub`,
    );

    const response = await this.makeHttpRequest({
      path: 'api/payments/mpesa/initiate',
      method: 'POST',
      payload,
    });

    return {
      merchantRequestId:
        response.merchant_request_id || response.merchantRequestId,
      checkoutRequestId:
        response.checkout_request_id || response.checkoutRequestId,
      responseCode: response.response_code || response.responseCode || '0',
      responseDescription:
        response.response_description ||
        response.responseDescription ||
        'Success',
      customerMessage:
        response.customer_message ||
        response.customerMessage ||
        'Payment request sent',
    };
  }

  async initiateAirtelPayment(
    payload: PaymentHubAirtelRequest,
  ): Promise<PaymentHubAirtelResponse> {
    this.logger.log(
      `Initiating Airtel payment for partner ${payload.partnerId} via PaymentHub`,
    );

    const response = await this.makeHttpRequest({
      path: 'api/payments/airtel/initiate',
      method: 'POST',
      payload,
    });

    return {
      transactionId: response.transaction_id || response.transactionId,
      status: response.status || 'pending',
      message: response.message || 'Payment request sent',
    };
  }

  async queryMpesaStatus(
    transactionId: string,
  ): Promise<PaymentHubStatusResponse> {
    this.logger.log(
      `Querying Mpesa status for transaction ${transactionId} via PaymentHub`,
    );

    const response = await this.makeHttpRequest({
      path: `api/payments/mpesa/status/${transactionId}`,
      method: 'GET',
    });

    return {
      transactionId: response.transaction_id || transactionId,
      status: response.status || 'pending',
      amount: response.amount,
      currency: response.currency,
      responseCode: response.response_code,
      responseDescription: response.response_description,
      merchantRequestId: response.merchant_request_id,
      checkoutRequestId: response.checkout_request_id,
      resultCode: response.result_code,
      resultDesc: response.result_desc,
    };
  }

  async queryAirtelStatus(
    transactionId: string,
  ): Promise<PaymentHubStatusResponse> {
    this.logger.log(
      `Querying Airtel status for transaction ${transactionId} via PaymentHub`,
    );

    const response = await this.makeHttpRequest({
      path: `api/payments/airtel/status/${transactionId}`,
      method: 'GET',
    });

    return {
      transactionId: response.transaction_id || transactionId,
      status: response.status || 'pending',
      amount: response.amount,
      currency: response.currency,
    };
  }
}
