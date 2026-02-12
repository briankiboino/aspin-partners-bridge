import { PartnerConfigurationEntity } from '../entities/partner.configuration.entity';

export interface PartnerConfigurationsRepository {
  getConfig(
    partnerId: string,
    channel: string,
  ): Promise<PartnerConfigurationEntity | null>;
  getDefaultConfig(channel: string): Promise<PartnerConfigurationEntity | null>;
}
