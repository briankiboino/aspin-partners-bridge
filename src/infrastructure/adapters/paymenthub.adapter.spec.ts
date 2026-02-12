import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import {
  PaymentHubAdapterImpl,
  PaymentHubMpesaRequest,
} from './paymenthub.adapter';
import { PaymentHubException } from '../../shared/exceptions/payment.exceptions';

describe('PaymentHubAdapterImpl', () => {
  let adapter: PaymentHubAdapterImpl;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockHttpService = {
    request: jest.fn(),
    axiosRef: {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'PAYMENTHUB_API_BASE_URL') return 'http://mock-api';
      if (key === 'PAYMENTHUB_API_KEY') return 'mock-api-key';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentHubAdapterImpl,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    adapter = module.get<PaymentHubAdapterImpl>(PaymentHubAdapterImpl);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateMpesaPayment', () => {
    const payload: PaymentHubMpesaRequest = {
      partnerId: '123',
      phoneNumber: '254700000000',
      amount: 5000,
    };

    it('should successfully initiate payment and return expected response', async () => {
      const mockResponse = {
        data: {
          transaction_id: 'TXN_123456',
          status: 'pending',
          amount: 5000,
          currency: 'KES',
          timestamp: '2026-01-29T10:30:00Z',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      jest
        .spyOn(httpService, 'request')
        .mockReturnValue(of(mockResponse as any));

      const result = await adapter.initiateMpesaPayment(payload);

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'http://mock-api/api/payments/mpesa/initiate',
          data: payload,
        }),
      );

      expect(result).toEqual({
        transaction_id: 'TXN_123456',
        status: 'pending',
        amount: 5000,
        currency: 'KES',
        timestamp: '2026-01-29T10:30:00Z',
      });
    });

    it('should throw PaymentHubException when API call fails', async () => {
      const error = new Error('Network Error');
      jest
        .spyOn(httpService, 'request')
        .mockReturnValue(throwError(() => error));

      await expect(adapter.initiateMpesaPayment(payload)).rejects.toThrow(
        PaymentHubException,
      );
    });

    it('should throw PaymentHubException when API returns error status', async () => {
      const error = {
        message: 'Request failed with status code 400',
        response: {
          status: 400,
          data: { message: 'Invalid payload' },
        },
      };
      jest
        .spyOn(httpService, 'request')
        .mockReturnValue(throwError(() => error));

      await expect(adapter.initiateMpesaPayment(payload)).rejects.toThrow(
        PaymentHubException,
      );
    });
  });

  describe('initiateAirtelPayment', () => {
    const payload = {
      partnerId: '456',
      phoneNumber: '254733000000',
      amount: 1000,
    };

    it('should successfully initiate airtel payment', async () => {
      const mockResponse = {
        data: {
          transaction_id: 'TXN_AIRTEL_123',
          status: 'pending',
          amount: 1000,
          currency: 'KES',
          timestamp: '2026-01-29T10:30:00Z',
        },
      };

      jest
        .spyOn(httpService, 'request')
        .mockReturnValue(of(mockResponse as any));

      const result = await adapter.initiateAirtelPayment(payload);

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'http://mock-api/api/payments/airtel/initiate',
        }),
      );

      expect(result).toEqual({
        transaction_id: 'TXN_AIRTEL_123',
        status: 'pending',
        amount: 1000,
        currency: 'KES',
        timestamp: '2026-01-29T10:30:00Z',
      });
    });
  });

  describe('queryMpesaStatus', () => {
    const transactionId = 'TXN_123456';

    it('should successfully query transaction status', async () => {
      const mockResponse = {
        data: {
          transaction_id: 'TXN_123456',
          status: 'completed',
          amount: 5000,
          currency: 'KES',
          timestamp: '2026-01-29T10:30:00Z',
        },
      };

      jest
        .spyOn(httpService, 'request')
        .mockReturnValue(of(mockResponse as any));

      const result = await adapter.queryMpesaStatus(transactionId);

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: `http://mock-api/api/payments/mpesa/status/${transactionId}`,
        }),
      );

      expect(result).toEqual({
        transaction_id: 'TXN_123456',
        status: 'completed',
        amount: 5000,
        currency: 'KES',
        timestamp: '2026-01-29T10:30:00Z',
      });
    });

    it('should handle failure when querying status', async () => {
      const error = new Error('Not Found');
      jest
        .spyOn(httpService, 'request')
        .mockReturnValue(throwError(() => error));

      await expect(adapter.queryMpesaStatus(transactionId)).rejects.toThrow(
        PaymentHubException,
      );
    });
  });

  describe('queryAirtelStatus', () => {
    const transactionId = 'TXN_AIRTEL_123';

    it('should successfully query airtel transaction status', async () => {
      const mockResponse = {
        data: {
          transaction_id: 'TXN_AIRTEL_123',
          status: 'failed',
          amount: 1000,
          currency: 'KES',
        },
      };

      jest
        .spyOn(httpService, 'request')
        .mockReturnValue(of(mockResponse as any));

      const result = await adapter.queryAirtelStatus(transactionId);

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: `http://mock-api/api/payments/airtel/status/${transactionId}`,
        }),
      );

      expect(result).toEqual({
        transaction_id: 'TXN_AIRTEL_123',
        status: 'failed',
        amount: 1000,
        currency: 'KES',
        timestamp: undefined,
      });
    });
  });
});
