import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  MpesaQueryResponse,
  MpesaStkPushPayload,
  MpesaStkPushResponse,
} from 'src/application/dto/payments/channel.dto';
import {
  ChannelConfiguration,
  IMpesaChannel,
} from 'src/application/interfaces/channel.interface';
import { PaymentChannel } from 'src/shared/constants/payments';
import * as crypto from 'crypto';
import { PartnerConfigurationsRepository } from 'src/domain/repositories/partner.configurations.repository';
import { PaymentHubAdapter } from 'src/application/interfaces/paymenthub.adapter.interface';

@Injectable()
export abstract class BaseMpesaChannel implements IMpesaChannel {
  protected readonly logger = new Logger(BaseMpesaChannel.name);

  constructor(
    @Inject('PartnerConfigurationsRepository')
    protected readonly configRepository: PartnerConfigurationsRepository,
    @Inject('PaymentHubAdapter')
    protected readonly paymentHubAdapter: PaymentHubAdapter,
  ) {}

  getChannelType(): PaymentChannel {
    return PaymentChannel.MPESA;
  }

  async loadConfig(partnerId: string): Promise<ChannelConfiguration> {
    this.logger.log(`Loading Mpesa config for partner: ${partnerId}`);

    const config = await this.configRepository.getConfig(
      partnerId,
      PaymentChannel.MPESA,
    );

    if (!config) {
      throw new Error(
        `Mpesa configuration not found for partner: ${partnerId}`,
      );
    }

    return config;
  }

  validateConfig(config: ChannelConfiguration): boolean {
    const required = [
      'consumerKey',
      'consumerSecret',
      'businessShortCode',
      'passkey',
    ];
    const configData = config.config;

    return required.every((field) => configData[field]);
  }

  async stkPush(payload: MpesaStkPushPayload): Promise<MpesaStkPushResponse> {
    try {
      const config = await this.loadConfig(payload.partnerId);

      this.logger.log(
        `Forwarding Mpesa STK Push to PaymentHub for ${payload.partnerId}`,
      );

      const paymentHubPayload = {
        partnerId: payload.partnerId,
        channel: PaymentChannel.MPESA,
        credentials: {
          consumerKey: config.config.consumerKey,
          consumerSecret: config.config.consumerSecret,
          businessShortCode: config.config.businessShortCode,
          passkey: config.config.passkey,
        },
        payment: {
          phoneNumber: payload.phoneNumber,
          amount: payload.amount,
          accountReference: payload.accountReference,
          transactionDesc: payload.transactionDesc,
          callbackUrl: config.config.callbackUrl,
        },
      };

      const response = await this.paymentHubAdapter.initiateMpesaPayment(
        paymentHubPayload,
      );

      return {
        merchantRequestId: response.merchantRequestId,
        checkoutRequestId: response.checkoutRequestId,
        responseCode: response.responseCode,
        responseDescription: response.responseDescription,
        customerMessage: response.customerMessage,
      };
    } catch (error) {
      this.logger.error(
        `Mpesa STK Push forwarding failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async queryTransaction(transactionId: string): Promise<MpesaQueryResponse> {
    try {
      this.logger.log(
        `Querying Mpesa transaction status via PaymentHub: ${transactionId}`,
      );

      const response = await this.paymentHubAdapter.queryMpesaStatus(
        transactionId,
      );

      return {
        responseCode: response.responseCode,
        responseDescription: response.responseDescription,
        merchantRequestId: response.merchantRequestId,
        checkoutRequestId: response.checkoutRequestId,
        resultCode: response.resultCode,
        resultDesc: response.resultDesc,
      };
    } catch (error) {
      this.logger.error(
        `Mpesa status query failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  validateCallback(payload: any, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return payload.signature === expectedSignature;
  }
}
