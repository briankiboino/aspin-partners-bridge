import { Test, TestingModule } from '@nestjs/testing';
import { BaseAirtelChannel } from './airtel.base.channel';
import { PaymentChannel } from 'src/shared/constants/payments';

class TestAirtelChannel extends BaseAirtelChannel {}

describe('BaseAirtelChannel', () => {
  let channel: TestAirtelChannel;
  let configRepository: any;
  let paymentHubAdapter: any;

  beforeEach(async () => {
    configRepository = {
      getConfig: jest.fn(),
    };

    paymentHubAdapter = {
      initiateAirtelPayment: jest.fn(),
      queryAirtelStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestAirtelChannel,
        {
          provide: 'PartnerConfigurationsRepository',
          useValue: configRepository,
        },
        {
          provide: 'PaymentHubAdapter',
          useValue: paymentHubAdapter,
        },
      ],
    }).compile();

    channel = module.get<TestAirtelChannel>(TestAirtelChannel);
  });

  it('should be defined', () => {
    expect(channel).toBeDefined();
  });

  describe('loadConfig', () => {
    it('should load config successfully', async () => {
      const mockConfig = { config: { some: 'config' } };
      configRepository.getConfig.mockResolvedValue(mockConfig);

      const result = await channel.loadConfig('partner1');
      expect(result).toBe(mockConfig);
      expect(configRepository.getConfig).toHaveBeenCalledWith(
        'partner1',
        PaymentChannel.AIRTEL,
      );
    });

    it('should throw error if config not found', async () => {
      configRepository.getConfig.mockResolvedValue(null);
      await expect(channel.loadConfig('partner1')).rejects.toThrow(
        'Airtel configuration not found',
      );
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const config = {
        config: {
          clientId: 'id',
          clientSecret: 'secret',
          merchantId: 'merchant',
        },
      } as any;
      expect(channel.validateConfig(config)).toBe(true);
    });

    it('should fail invalid config', () => {
      const config = {
        config: {
          clientId: 'id',
          // missing clientSecret
          merchantId: 'merchant',
        },
      } as any;
      expect(channel.validateConfig(config)).toBe(false);
    });
  });

  describe('directDebit', () => {
    const payload = {
      phoneNumber: '254700000000',
      amount: 100,
      reference: 'REF',
      partnerId: 'partner1',
    };

    const mockConfig = {
      config: {
        clientId: 'id',
        clientSecret: 'secret',
        merchantId: 'merchant',
        callbackUrl: 'http://callback',
      },
    };

    it('should initiate Direct Debit successfully', async () => {
      configRepository.getConfig.mockResolvedValue(mockConfig);
      paymentHubAdapter.initiateAirtelPayment.mockResolvedValue({
        transaction_id: 'TXN123',
        status: 'pending',
        amount: 100,
        currency: 'KES',
        timestamp: '2023-01-01T00:00:00Z',
      });

      const result = await channel.directDebit(payload);

      expect(result).toEqual({
        transactionId: 'TXN123',
        status: 'pending',
        amount: 100,
        currency: 'KES',
        timestamp: '2023-01-01T00:00:00Z',
      });
      expect(paymentHubAdapter.initiateAirtelPayment).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      configRepository.getConfig.mockResolvedValue(mockConfig);
      paymentHubAdapter.initiateAirtelPayment.mockRejectedValue(
        new Error('API Error'),
      );

      await expect(channel.directDebit(payload)).rejects.toThrow('API Error');
    });
  });

  describe('queryTransaction', () => {
    it('should query transaction successfully', async () => {
      paymentHubAdapter.queryAirtelStatus.mockResolvedValue({
        transaction_id: 'TXN123',
        status: 'completed',
        amount: 100,
        currency: 'KES',
        timestamp: '2023-01-01T00:00:00Z',
      });

      const result = await channel.queryTransaction('TXN123');

      expect(result).toEqual({
        transactionId: 'TXN123',
        status: 'completed',
        amount: 100,
        currency: 'KES',
        timestamp: '2023-01-01T00:00:00Z',
      });
    });
  });
});
