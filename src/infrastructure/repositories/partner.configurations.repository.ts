import { Injectable, Logger, Inject } from '@nestjs/common';
import { PartnerConfigurationsRepository } from '../../domain/repositories/partner.configurations.repository';
import { PartnerConfigurationEntity } from '../../domain/entities/partner.configuration.entity';
import { SecretsManager } from '../../application/interfaces/secrets.manager.interface';
import { PaymentChannel } from 'src/shared/constants/payments';

@Injectable()
export class PartnerConfigurationsRepositoryImpl
  implements PartnerConfigurationsRepository
{
  private readonly logger = new Logger(
    PartnerConfigurationsRepositoryImpl.name,
  );

  constructor(
    @Inject('SecretsManager') private readonly secretsManager: SecretsManager,
  ) {}

  async getConfig(
    partnerId: string,
    channel: PaymentChannel,
  ): Promise<PartnerConfigurationEntity | null> {
    this.logger.log(
      `Fetching configuration for partner: ${partnerId} on channel: ${channel}`,
    );

    try {
      const secretId = `${partnerId}_${channel.toLowerCase()}`;
      const config = await this.secretsManager.getSecret(secretId);

      if (!config) {
        this.logger.warn(`No configuration found for ${secretId}`);
        return null;
      }

      const partnerConfig = new PartnerConfigurationEntity();
      partnerConfig.partnerId = partnerId;
      partnerConfig.channel = channel;
      partnerConfig.config = config;

      return partnerConfig;
    } catch (error) {
      this.logger.error(
        `Failed to fetch configuration for ${partnerId}: ${error.message}`,
      );
      throw error;
    }
  }

  async getDefaultConfig(
    channel: PaymentChannel,
  ): Promise<PartnerConfigurationEntity | null> {
    this.logger.log(`Fetching default configuration for channel: ${channel}`);

    try {
      const secretId = `default_${channel.toLowerCase()}`;
      const config = await this.secretsManager.getSecret(secretId);

      if (!config) {
        this.logger.warn(`No default configuration found for ${secretId}`);
        return null;
      }

      const partnerConfig = new PartnerConfigurationEntity();
      partnerConfig.partnerId = 'default';
      partnerConfig.channel = channel;
      partnerConfig.config = config;

      return partnerConfig;
    } catch (error) {
      this.logger.error(
        `Failed to fetch default configuration for ${channel}: ${error.message}`,
      );
      throw error;
    }
  }
}
