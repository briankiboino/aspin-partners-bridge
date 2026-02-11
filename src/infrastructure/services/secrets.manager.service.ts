import { Injectable, Logger } from '@nestjs/common';
import { SecretsManager } from '../../application/interfaces/secrets.manager.interface';

@Injectable()
export class MockSecretsManagerService implements SecretsManager {
  private readonly logger = new Logger(MockSecretsManagerService.name);

  async getSecret(secretId: string): Promise<Record<string, any>> {
    this.logger.log(`Retrieving secret for: ${secretId}`);
    if (secretId.includes('airtel') && !secretId.startsWith('default_')) {
      return {
        client_id: 'mock_airtel_client_id',
        client_secret: 'mock_airtel_client_secret',
        merchant_id: 'AIRTEL_MONEY_KE',
      };
    }

    if (secretId.startsWith('default_')) {
      if (secretId.includes('mpesa')) {
        return {
          consumerKey: 'default_mpesa_key',
          consumerSecret: 'default_mpesa_secret',
          passKey: 'default_pass_key',
          paybill: '000000',
        };
      }
      if (secretId.includes('airtel')) {
        return {
          client_id: 'default_airtel_client',
          client_secret: 'default_airtel_secret',
          merchant_id: 'DEFAULT_AIRTEL',
        };
      }
    }

    return {
      consumerKey: 'mock_consumer_key',
      consumerSecret: 'mock_consumer_secret',
      passKey: 'mock_pass_key',
      paybill: '174379',
      callbackUrl: 'https://callback.url',
    };
  }
}
