import { Test, TestingModule } from '@nestjs/testing';
import { PartnerConfigurationsRepositoryImpl } from './partner.configurations.repository';
import { PaymentChannel } from '../../shared/constants/payments';

jest.mock('typeorm', () => ({
  Entity: jest.fn().mockReturnValue(jest.fn()),
  PrimaryColumn: jest.fn().mockReturnValue(jest.fn()),
  Column: jest.fn().mockReturnValue(jest.fn()),
}));

import { PartnerConfigurationEntity } from '../../domain/entities/partner.configuration.entity';

describe('PartnerConfigurationsRepositoryImpl', () => {
  let repository: PartnerConfigurationsRepositoryImpl;

  const mockSecretsManager = {
    getSecret: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnerConfigurationsRepositoryImpl,
        {
          provide: 'SecretsManager',
          useValue: mockSecretsManager,
        },
      ],
    }).compile();

    repository = module.get<PartnerConfigurationsRepositoryImpl>(
      PartnerConfigurationsRepositoryImpl,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('getConfig', () => {
    const partnerId = 'test-partner';
    const channel = PaymentChannel.MPESA;
    const secretId = `${partnerId}_${channel.toLowerCase()}`;
    const mockConfig = { some: 'config' };

    it('should return partner configuration when secret exists', async () => {
      mockSecretsManager.getSecret.mockResolvedValue(mockConfig);

      const result = await repository.getConfig(partnerId, channel);

      expect(mockSecretsManager.getSecret).toHaveBeenCalledWith(secretId);
      expect(result).toBeInstanceOf(PartnerConfigurationEntity);
      expect(result).toEqual({
        partnerId,
        channel,
        config: mockConfig,
      });
    });

    it('should return null when secret does not exist', async () => {
      mockSecretsManager.getSecret.mockResolvedValue(null);

      const result = await repository.getConfig(partnerId, channel);

      expect(mockSecretsManager.getSecret).toHaveBeenCalledWith(secretId);
      expect(result).toBeNull();
    });

    it('should throw error when secrets manager fails', async () => {
      const error = new Error('Secrets manager error');
      mockSecretsManager.getSecret.mockRejectedValue(error);

      await expect(repository.getConfig(partnerId, channel)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getDefaultConfig', () => {
    const channel = PaymentChannel.AIRTEL;
    const secretId = `default_${channel.toLowerCase()}`;
    const mockConfig = { default: 'config' };

    it('should return default configuration when secret exists', async () => {
      mockSecretsManager.getSecret.mockResolvedValue(mockConfig);

      const result = await repository.getDefaultConfig(channel);

      expect(mockSecretsManager.getSecret).toHaveBeenCalledWith(secretId);
      expect(result).toBeInstanceOf(PartnerConfigurationEntity);
      expect(result).toEqual({
        partnerId: 'default',
        channel,
        config: mockConfig,
      });
    });

    it('should return null when secret does not exist', async () => {
      mockSecretsManager.getSecret.mockResolvedValue(null);

      const result = await repository.getDefaultConfig(channel);

      expect(mockSecretsManager.getSecret).toHaveBeenCalledWith(secretId);
      expect(result).toBeNull();
    });

    it('should throw error when secrets manager fails', async () => {
      const error = new Error('Secrets manager error');
      mockSecretsManager.getSecret.mockRejectedValue(error);

      await expect(repository.getDefaultConfig(channel)).rejects.toThrow(error);
    });
  });
});
