import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { AspinAdapter } from '../../application/interfaces/aspin.adapter.interface';
import { PaymentNotificationResponse } from 'src/application/dto/payments/output';

type HTTPRequestConfig = {
  path: string;
  payload?: any;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT';
  authToken?: string;
};

@Injectable()
export class AspinAdapterImpl implements AspinAdapter {
  private readonly logger = new Logger(AspinAdapterImpl.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('ASPIN_API_BASE_URL');
    this.apiKey = this.configService.get<string>('ASPIN_API_KEY');
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
      this.logger.error('Aspin API call failed', error?.message);
      throw new Error(`Aspin API call failed: ${error?.message}`);
    }
  }

  async notifyPaymentStatus(
    payload: PaymentNotificationResponse,
  ): Promise<void> {
    await this.makeHttpRequest({
      path: 'payments/status-update',
      method: 'POST',
      payload,
    });

    this.logger.log(
      `Notified Aspin of payment status: ${payload.transaction_id}`,
    );
  }
}
