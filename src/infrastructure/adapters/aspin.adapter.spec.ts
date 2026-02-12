import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AspinAdapterImpl } from './aspin.adapter';
import { PaymentNotificationResponse } from '../../application/dto/payments/output';
import { PaymentNotificationStatus } from 'src/shared/constants/payments';

describe('AspinAdapterImpl', () => {
  let adapter: AspinAdapterImpl;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockHttpService = {
    request: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'ASPIN_API_BASE_URL') return 'http://mock-aspin-api';
      if (key === 'ASPIN_API_KEY') return 'mock-api-key';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AspinAdapterImpl,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    adapter = module.get<AspinAdapterImpl>(AspinAdapterImpl);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('notifyPaymentStatus', () => {
    const payload: PaymentNotificationResponse = {
      transaction_id: 'txn_123',
      status: PaymentNotificationStatus.SUCCESS,
      amount: 1000,
      currency: 'KES',
      timestamp: new Date().toISOString(),
      signature: 'mock-signature',
    };

    it('should successfully notify payment status', async () => {
      const mockResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      jest
        .spyOn(httpService, 'request')
        .mockReturnValue(of(mockResponse as any));

      await adapter.notifyPaymentStatus(payload);

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'http://mock-aspin-api/payments/status-update',
          data: payload,
          headers: expect.objectContaining({
            'x-api-key': 'mock-api-key',
            Accept: 'application/json',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should throw Error when API call fails', async () => {
      const error = new Error('Network Error');
      jest
        .spyOn(httpService, 'request')
        .mockReturnValue(throwError(() => error));

      await expect(adapter.notifyPaymentStatus(payload)).rejects.toThrow(
        'Aspin API call failed: Network Error',
      );
    });
  });
});
