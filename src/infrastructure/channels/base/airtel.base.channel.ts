import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  AirtelDirectDebitPayload,
  AirtelDirectDebitResponse,
  AirtelQueryResponse,
} from 'src/application/dto/payments/channel.dto';
import {
  ChannelConfiguration,
  IAirtelChannel,
} from 'src/application/interfaces/channel.interface';
import { PaymentChannel } from 'src/shared/constants/payments';
import * as crypto from 'crypto';
import { PartnerConfigurationsRepository } from 'src/domain/repositories/partner.configurations.repository';
import { PaymentHubAdapter } from 'src/application/interfaces/paymenthub.adapter.interface';

@Injectable()
export abstract class BaseAirtelChannel implements IAirtelChannel {
  protected readonly logger = new Logger(BaseAirtelChannel.name);

  constructor(
    @Inject('PartnerConfigurationsRepository')
    protected readonly configRepository: PartnerConfigurationsRepository,
    @Inject('PaymentHubAdapter')
    protected readonly paymentHubAdapter: PaymentHubAdapter,
  ) {}

  getChannelType(): PaymentChannel {
    return PaymentChannel.AIRTEL;
  }

  async loadConfig(partnerId: string): Promise<ChannelConfiguration> {
    this.logger.log(`Loading Airtel config for partner: ${partnerId}`);

    const config = await this.configRepository.getConfig(
      partnerId,
      PaymentChannel.AIRTEL,
    );

    if (!config) {
      throw new Error(
        `Airtel configuration not found for partner: ${partnerId}`,
      );
    }

    return config;
  }

  validateConfig(config: ChannelConfiguration): boolean {
    const required = ['clientId', 'clientSecret', 'merchantId'];
    const configData = config.config;

    return required.every((field) => configData[field]);
  }

  async directDebit(
    payload: AirtelDirectDebitPayload,
  ): Promise<AirtelDirectDebitResponse> {
    try {
      const config = await this.loadConfig(payload.partnerId);

      this.logger.log(
        `Forwarding Airtel Direct Debit to PaymentHub for ${payload.partnerId}`,
      );

      const paymentHubPayload = {
        partnerId: payload.partnerId,
        channel: PaymentChannel.AIRTEL,

        credentials: {
          clientId: config.config.clientId,
          clientSecret: config.config.clientSecret,
          merchantId: config.config.merchantId,
        },

        payment: {
          phoneNumber: payload.phoneNumber,
          amount: payload.amount,
          reference: payload.reference,
          country: 'KE',
          currency: 'KES',
          callbackUrl: config.config.callbackUrl,
        },
      };

      const response = await this.paymentHubAdapter.initiateAirtelPayment(
        paymentHubPayload,
      );

      return {
        transactionId: response.transaction_id,
        status: response.status,
        amount: response.amount,
        currency: response.currency,
        timestamp: response.timestamp,
      };
    } catch (error) {
      this.logger.error(
        `Airtel Direct Debit forwarding failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async queryTransaction(transactionId: string): Promise<AirtelQueryResponse> {
    try {
      this.logger.log(
        `Querying Airtel transaction status via PaymentHub: ${transactionId}`,
      );

      const response = await this.paymentHubAdapter.queryAirtelStatus(
        transactionId,
      );

      return {
        transactionId: response.transaction_id,
        status: response.status,
        amount: response.amount,
        currency: response.currency,
        timestamp: response.timestamp,
      };
    } catch (error) {
      this.logger.error(
        `Airtel status query failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  validateCallback(payload: any, secret: string): boolean {
    const { signature, ...data } = payload;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(data))
      .digest('hex');

    return signature === expectedSignature;
  }
}
