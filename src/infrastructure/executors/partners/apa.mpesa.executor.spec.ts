import { Test, TestingModule } from '@nestjs/testing';
import { ApaMpesaExecutor } from './apa.mpesa.executor';
import { ApaMpesaChannel } from 'src/infrastructure/channels/partners/apa.mpesa.channel';
import { PaymentChannel } from 'src/shared/constants/payments';
import { PaymentRepositoryImpl } from '../../repositories/payments.postgres.repository';
import { QueueServiceImpl } from '../../queue/queue.service.impl';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';

const mockPaymentRepository = {
  findByTransactionId: jest.fn(),
  update: jest.fn(),
};

const mockChannel = {
  loadConfig: jest.fn(),
  validateCallback: jest.fn(),
};

const mockAspinAdapter = {
  notifyPaymentStatus: jest.fn(),
};

const mockQueueService = {
  addJob: jest.fn(),
};

const mockRabbitMQService = {
  publish: jest.fn(),
};

describe('ApaMpesaExecutor', () => {
  let executor: ApaMpesaExecutor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApaMpesaExecutor,
        {
          provide: ApaMpesaChannel,
          useValue: mockChannel,
        },
        {
          provide: PaymentRepositoryImpl,
          useValue: mockPaymentRepository,
        },
        {
          provide: QueueServiceImpl,
          useValue: mockQueueService,
        },
        {
          provide: RabbitMQService,
          useValue: mockRabbitMQService,
        },
        {
          provide: 'AspinAdapter',
          useValue: mockAspinAdapter,
        },
      ],
    }).compile();

    executor = module.get<ApaMpesaExecutor>(ApaMpesaExecutor);
  });

  it('should be defined', () => {
    expect(executor).toBeDefined();
  });

  it('should return correct partner', () => {
    expect(executor.getPartner()).toBe('APA');
  });

  it('should return correct channel', () => {
    expect(executor.getChannel()).toBe(PaymentChannel.MPESA);
  });

  describe('handleCallback', () => {
    const payload = {
      transaction_id: 'tx-123',
      status: 'completed',
      partner_id: 'APA',
      amount: 100,
      currency: 'KES',
      timestamp: new Date().toISOString(),
      signature: 'valid-signature',
    };

    const paymentRecord = {
      transactionId: 'tx-123',
      partner_id: 'APA',
      channel: PaymentChannel.MPESA,
      amount: 100,
      currency: 'KES',
      status: 'pending',
      updatedAt: new Date(),
      customerId: 'cust-123',
      reference: 'ref-123',
      processed: false,
    };

    it('should process valid webhook successfully', async () => {
      // Mock repository finding the transaction
      mockPaymentRepository.findByTransactionId.mockResolvedValue(
        paymentRecord,
      );

      // Mock channel config and validation
      mockChannel.loadConfig.mockResolvedValue({
        config: { webhookSecret: 'secret' },
      });
      mockChannel.validateCallback.mockReturnValue(true);

      // Mock repository update
      mockPaymentRepository.update.mockResolvedValue({
        ...paymentRecord,
        status: 'completed',
        processed: true,
      });

      // Mock AspinAdapter notification
      mockAspinAdapter.notifyPaymentStatus.mockResolvedValue(undefined);

      const result = await executor.handleCallback(payload as any);

      // Assertions
      expect(mockPaymentRepository.findByTransactionId).toHaveBeenCalledWith(
        'tx-123',
      );
      expect(mockChannel.validateCallback).toHaveBeenCalledWith(
        payload,
        'secret',
      );
      expect(mockPaymentRepository.update).toHaveBeenCalledWith('tx-123', {
        status: 'completed',
        processed: true,
      });
      expect(mockAspinAdapter.notifyPaymentStatus).toHaveBeenCalled();

      // Verify result
      expect(result.status).toBe('completed');
      expect(result.transactionId).toBe('tx-123');
    });

    it('should handle idempotency (duplicate webhook)', async () => {
      // Mock repository finding the transaction that is ALREADY processed
      mockPaymentRepository.findByTransactionId.mockResolvedValue({
        ...paymentRecord,
        processed: true,
        status: 'completed',
      });

      const result = await executor.handleCallback(payload as any);

      // Assertions
      expect(mockPaymentRepository.findByTransactionId).toHaveBeenCalledWith(
        'tx-123',
      );
      // Should NOT validate callback or update DB or notify Aspin again
      expect(mockChannel.validateCallback).not.toHaveBeenCalled();
      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(mockAspinAdapter.notifyPaymentStatus).not.toHaveBeenCalled();

      // Verify result returns existing status
      expect(result.status).toBe('completed');
    });

    it('should throw error for invalid signature', async () => {
      // Mock repository finding the transaction
      mockPaymentRepository.findByTransactionId.mockResolvedValue(
        paymentRecord,
      );

      // Mock channel config and validation returning false
      mockChannel.loadConfig.mockResolvedValue({
        config: { webhookSecret: 'secret' },
      });
      mockChannel.validateCallback.mockReturnValue(false);

      await expect(executor.handleCallback(payload as any)).rejects.toThrow(
        'Invalid callback signature',
      );

      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(mockAspinAdapter.notifyPaymentStatus).not.toHaveBeenCalled();
    });
  });
});
