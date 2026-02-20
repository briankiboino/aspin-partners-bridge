import { Test, TestingModule } from '@nestjs/testing';
import { ApaMpesaExecutor } from './apa.mpesa.executor';
import { ApaMpesaChannel } from 'src/infrastructure/channels/partners/apa.mpesa.channel';
import { PaymentChannel } from 'src/shared/constants/payments';
import { PaymentRepositoryImpl } from '../../repositories/payments.postgres.repository';
import { QueueServiceImpl } from '../../queue/queue.service.impl';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { MetricsService } from '../../monitoring/metrics.service';
import { ConfigService } from '@nestjs/config';
import { RedisProvider } from '../../database/redis.provider';

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
  publishPaymentCompleted: jest.fn(),
  publishPaymentFailed: jest.fn(),
  publishPaymentPending: jest.fn(),
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
        {
          provide: MetricsService,
          useValue: {
            incrementPaymentSuccess: jest.fn(),
            incrementPaymentFailure: jest.fn(),
            incrementWebhookReceived: jest.fn(),
            incrementWebhookProcessed: jest.fn(),
            incrementWebhookFailed: jest.fn(),
            recordPaymentDuration: jest.fn(),
            recordWebhookProcessingDuration: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: RedisProvider,
          useValue: {
            getClient: jest.fn().mockReturnValue({
              set: jest.fn().mockResolvedValue('OK'),
              del: jest.fn().mockResolvedValue(1),
            }),
          },
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
      createdAt: new Date(),
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

      mockPaymentRepository.update.mockResolvedValue({
        ...paymentRecord,
        status: 'completed',
        processed: true,
      });

      mockAspinAdapter.notifyPaymentStatus.mockResolvedValue(undefined);

      const result = await executor.handleCallback(payload as any);

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

      expect(mockPaymentRepository.findByTransactionId).toHaveBeenCalledWith(
        'tx-123',
      );

      expect(mockChannel.validateCallback).not.toHaveBeenCalled();
      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(mockAspinAdapter.notifyPaymentStatus).not.toHaveBeenCalled();

      expect(result.status).toBe('completed');
    });

    it('should throw error for invalid signature', async () => {
      mockPaymentRepository.findByTransactionId.mockResolvedValue(
        paymentRecord,
      );

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
