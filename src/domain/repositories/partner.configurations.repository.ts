import { PartnerConfiguration } from '../entities/partner.configuration.entity';

export interface PartnerConfigurationsRepository {
  getConfig(
    partnerId: string,
    channel: string,
  ): Promise<PartnerConfiguration | null>;
  getDefaultConfig(channel: string): Promise<PartnerConfiguration | null>;
}
