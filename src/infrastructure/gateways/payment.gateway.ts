import { PaymentGateway } from 'src/application/interfaces/payment.gateway.interface';
import { PartnerConfigurationsRepository } from '../../domain/repositories/partner.configurations.repository';

export abstract class PaymentGatewayImpl implements PaymentGateway {
  constructor(
    protected readonly channel: string,
    protected readonly configRepo: PartnerConfigurationsRepository,
  ) {}

  abstract loadConfig(partnerId: string): Promise<Record<string, any>>;
  abstract initiatePayment(payload: any): Promise<any>;
  abstract checkStatus(transactionId: string, partnerId: string): Promise<any>;
}
