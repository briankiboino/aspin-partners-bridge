import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsUseCaseImpl } from './payments.usecase';
import { PaymentChannel } from 'src/shared/constants/payments';
import { TransactionNotFoundException } from 'src/shared/exceptions/payment.exceptions';

jest.mock('src/domain/repositories/payments.postgres.repository', () => ({
  PaymentRepository: jest.fn(),
}));

jest.mock(
  'src/infrastructure/executors/builder/payment.executor.builder',
  () => ({
    PaymentExecutorBuilder: jest.fn(),
  }),
);

describe('PaymentsUseCaseImpl', () => {
  let useCase: PaymentsUseCaseImpl;
  let paymentRepository: any;
  let executorFactory: any;
  let mockExecutor: any;

  beforeEach(async () => {
    mockExecutor = {
      initiate: jest.fn(),
      handleCallback: jest.fn(),
      statusCheck: jest.fn(),
    };

    paymentRepository = {
      findByTransactionId: jest.fn(),
    };

    executorFactory = {
      getExecutor: jest.fn().mockReturnValue(mockExecutor),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsUseCaseImpl,
        {
          provide: 'PaymentRepository',
          useValue: paymentRepository,
        },
        {
          provide: 'PaymentExecutorBuilder',
          useValue: executorFactory,
        },
      ],
    }).compile();

    useCase = module.get<PaymentsUseCaseImpl>(PaymentsUseCaseImpl);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('initiatePayment', () => {
    const payload = {
      amount: 100,
      currency: 'KES',
      customer_id: 'cust_123',
      reference: 'ref_123',
      partner_id: 'partner_123',
      channel: PaymentChannel.MPESA,
    };

    it('should successfully initiate payment', async () => {
      const mockResult = {
        transactionId: 'txn_123',
        status: 'pending',
        amount: 100,
        currency: 'KES',
        timestamp: new Date(),
      };
      mockExecutor.initiate.mockResolvedValue(mockResult);

      const result = await useCase.initiatePayment(payload);

      expect(executorFactory.getExecutor).toHaveBeenCalledWith(
        payload.partner_id,
        payload.channel,
      );
      expect(mockExecutor.initiate).toHaveBeenCalledWith({
        amount: payload.amount,
        currency: payload.currency,
        customerId: payload.customer_id,
        reference: payload.reference,
        partnerId: payload.partner_id,
        channel: payload.channel,
      });
      expect(result).toEqual({
        success: true,
        data: {
          transaction_id: mockResult.transactionId,
          status: mockResult.status,
          amount: mockResult.amount,
          currency: mockResult.currency,
          timestamp: mockResult.timestamp,
        },
      });
    });
  });

  describe('handleWebhook', () => {
    it('should handle MPESA webhook', async () => {
      const payload = {
        partner_id: 'partner_123',
        MerchantRequestID: 'req_123',
      } as any;

      const mockResult = {
        transactionId: 'txn_123',
        status: 'completed',
      };
      mockExecutor.handleCallback.mockResolvedValue(mockResult);

      const result = await useCase.handleWebhook(payload);

      expect(executorFactory.getExecutor).toHaveBeenCalledWith(
        'PARTNER_123',
        PaymentChannel.MPESA,
      );
      expect(mockExecutor.handleCallback).toHaveBeenCalledWith(payload);
      expect(result).toEqual({
        transaction_id: mockResult.transactionId,
        status: mockResult.status,
        processed: true,
      });
    });

    it('should handle Airtel webhook', async () => {
      const payload = {
        partner_id: 'partner_123',
        data: { transaction: { id: 'txn_airtel' } },
      } as any;

      const mockResult = {
        transactionId: 'txn_123',
        status: 'completed',
      };
      mockExecutor.handleCallback.mockResolvedValue(mockResult);

      const result = await useCase.handleWebhook(payload);

      expect(executorFactory.getExecutor).toHaveBeenCalledWith(
        'PARTNER_123',
        PaymentChannel.AIRTEL,
      );
      expect(result.processed).toBe(true);
    });
  });

  describe('checkPayment', () => {
    const transactionId = 'txn_123';
    const mockTransaction = {
      partner_id: 'partner_123',
      channel: PaymentChannel.MPESA,
      amount: 100,
      currency: 'KES',
    };

    it('should return payment status when transaction exists', async () => {
      paymentRepository.findByTransactionId.mockResolvedValue(mockTransaction);
      const mockStatusResult = {
        transactionId: 'txn_123',
        status: 'completed',
        amount: 100,
        currency: 'KES',
        timestamp: new Date('2023-01-01'),
      };
      mockExecutor.statusCheck.mockResolvedValue(mockStatusResult);

      const result = await useCase.checkPayment(transactionId);

      expect(paymentRepository.findByTransactionId).toHaveBeenCalledWith(
        transactionId,
      );
      expect(executorFactory.getExecutor).toHaveBeenCalledWith(
        mockTransaction.partner_id,
        mockTransaction.channel,
      );
      expect(mockExecutor.statusCheck).toHaveBeenCalledWith(transactionId);
      expect(result).toEqual({
        transaction_id: 'txn_123',
        status: 'completed',
        amount: 100,
        currency: 'KES',
        timestamp: '2023-01-01T00:00:00.000Z',
        signature: '',
      });
    });

    it('should throw TransactionNotFoundException if transaction does not exist', async () => {
      paymentRepository.findByTransactionId.mockResolvedValue(null);

      await expect(useCase.checkPayment(transactionId)).rejects.toThrow(
        TransactionNotFoundException,
      );
    });
  });
});
