import { Test, TestingModule } from '@nestjs/testing';
import { BaseMpesaChannel } from './mpesa.base.channel';
import { PaymentChannel } from 'src/shared/constants/payments';

class TestMpesaChannel extends BaseMpesaChannel {}

describe('BaseMpesaChannel', () => {
  let channel: TestMpesaChannel;
  let configRepository: any;
  let paymentHubAdapter: any;

  beforeEach(async () => {
    configRepository = {
      getConfig: jest.fn(),
    };

    paymentHubAdapter = {
      initiateMpesaPayment: jest.fn(),
      queryMpesaStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestMpesaChannel,
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

    channel = module.get<TestMpesaChannel>(TestMpesaChannel);
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
        PaymentChannel.MPESA,
      );
    });

    it('should throw error if config not found', async () => {
      configRepository.getConfig.mockResolvedValue(null);
      await expect(channel.loadConfig('partner1')).rejects.toThrow(
        'Mpesa configuration not found',
      );
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const config = {
        config: {
          consumerKey: 'key',
          consumerSecret: 'secret',
          businessShortCode: '123456',
          passkey: 'pass',
        },
      } as any;
      expect(channel.validateConfig(config)).toBe(true);
    });

    it('should fail invalid config', () => {
      const config = {
        config: {
          consumerKey: 'key',
          // missing consumerSecret
          businessShortCode: '123456',
          passkey: 'pass',
        },
      } as any;
      expect(channel.validateConfig(config)).toBe(false);
    });
  });

  describe('stkPush', () => {
    const payload = {
      phoneNumber: '254700000000',
      amount: 100,
      accountReference: 'REF',
      transactionDesc: 'Desc',
      partnerId: 'partner1',
    };

    const mockConfig = {
      config: {
        consumerKey: 'key',
        consumerSecret: 'secret',
        businessShortCode: '123456',
        passkey: 'pass',
        callbackUrl: 'http://callback',
      },
    };

    it('should initiate STK push successfully', async () => {
      configRepository.getConfig.mockResolvedValue(mockConfig);
      paymentHubAdapter.initiateMpesaPayment.mockResolvedValue({
        transaction_id: 'TXN123',
        status: 'pending',
        amount: 100,
        currency: 'KES',
        timestamp: '2023-01-01T00:00:00Z',
      });

      const result = await channel.stkPush(payload);

      expect(result).toEqual({
        transactionId: 'TXN123',
        status: 'pending',
        amount: 100,
        currency: 'KES',
        timestamp: '2023-01-01T00:00:00Z',
      });
      expect(paymentHubAdapter.initiateMpesaPayment).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      configRepository.getConfig.mockResolvedValue(mockConfig);
      paymentHubAdapter.initiateMpesaPayment.mockRejectedValue(
        new Error('API Error'),
      );

      await expect(channel.stkPush(payload)).rejects.toThrow('API Error');
    });
  });

  describe('queryTransaction', () => {
    it('should query transaction successfully', async () => {
      paymentHubAdapter.queryMpesaStatus.mockResolvedValue({
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
