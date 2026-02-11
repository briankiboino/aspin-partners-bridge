import { Logger, Inject } from '@nestjs/common';
import { PartnerConfigurationsRepository } from '../../domain/repositories/partner.configurations.repository';
import { PaymentGatewayImpl } from './payment.gateway';
import { AirtelGateway as IAirtelGateway } from '../../application/interfaces/airtel.gateway.interface';
import { PaymentChannel } from '../../shared/constants/payments';
import { PaymentHubAdapter } from '../../application/interfaces/paymenthub.adapter.interface';
import { InitiatePaymentPayload } from '../../application/dto/payments/input';

export class AirtelGateway
  extends PaymentGatewayImpl
  implements IAirtelGateway
{
  private readonly logger = new Logger(AirtelGateway.name);

  constructor(
    configRepo: PartnerConfigurationsRepository,
    @Inject('PaymentHubAdapter')
    private readonly paymentHub: PaymentHubAdapter,
  ) {
    super(PaymentChannel.AIRTEL, configRepo);
  }

  async loadConfig(partnerId: string): Promise<Record<string, any>> {
    const partnerConfig = await this.configRepo.getConfig(
      partnerId,
      this.channel,
    );

    if (partnerConfig) {
      return partnerConfig.config;
    } else {
      const defaultConfig = await this.configRepo.getDefaultConfig(
        this.channel,
      );
      if (defaultConfig) {
        return defaultConfig.config;
      } else {
        throw new Error(
          `No configuration found for partner ${partnerId} on channel ${this.channel}`,
        );
      }
    }
  }

  async initiatePayment(payload: InitiatePaymentPayload): Promise<any> {
    const config = await this.loadConfig(payload.partner_id);
    this.logger.log(
      `Initiating Airtel payment for partner ${payload.partner_id} using config...`,
    );

    const enrichedPayload: InitiatePaymentPayload = {
      ...payload,
      config: config,
    };

    return this.paymentHub.initiatePayment(enrichedPayload);
  }

  async checkStatus(transactionId: string, partnerId: string): Promise<any> {
    this.logger.log(`Checking Airtel status for ${transactionId}`);
    const config = await this.loadConfig(partnerId);
    return this.paymentHub.checkPayment({
      transactionId,
      config,
      partnerId,
      channel: PaymentChannel.AIRTEL,
    });
  }
}
