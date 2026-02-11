import { Injectable, Logger } from '@nestjs/common';
import { PartnerConfigurationsRepository } from '../../domain/repositories/partner.configurations.repository';
import { PartnerConfiguration } from '../../domain/entities/partner.configuration.entity';
import { SecretsManager } from '../../application/interfaces/secrets.manager.interface';

@Injectable()
export class PartnerConfigurationsRepositoryImpl
  implements PartnerConfigurationsRepository
{
  private readonly logger = new Logger(
    PartnerConfigurationsRepositoryImpl.name,
  );

  constructor(private readonly secretsManager: SecretsManager) {}

  async getConfig(
    partnerId: string,
    channel: string,
  ): Promise<PartnerConfiguration | null> {
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

      const partnerConfig = new PartnerConfiguration();
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
    channel: string,
  ): Promise<PartnerConfiguration | null> {
    this.logger.log(`Fetching default configuration for channel: ${channel}`);

    try {
      const secretId = `default_${channel.toLowerCase()}`;
      const config = await this.secretsManager.getSecret(secretId);

      if (!config) {
        this.logger.warn(`No default configuration found for ${secretId}`);
        return null;
      }

      const partnerConfig = new PartnerConfiguration();
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
