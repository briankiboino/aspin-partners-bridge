import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueServiceImpl } from './queue.service.impl';
import { PaymentExecutorBuilder } from '../executors/builder/payment.executor.builder';
import { QueueTYPE, JobTYPE } from 'src/shared/constants/queue';
import { PaymentChannel } from 'src/shared/constants/payments';
import { Queue, Worker } from 'bullmq';

jest.mock('../executors/builder/payment.executor.builder', () => ({
  PaymentExecutorBuilder: jest.fn().mockImplementation(() => ({
    getExecutor: jest.fn(),
  })),
}));

// Mock bullmq
jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn(),
      getWaitingCount: jest.fn().mockResolvedValue(1),
      getActiveCount: jest.fn().mockResolvedValue(2),
      getCompletedCount: jest.fn().mockResolvedValue(3),
      getFailedCount: jest.fn().mockResolvedValue(4),
      close: jest.fn(),
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn(),
    })),
  };
});

describe('QueueServiceImpl', () => {
  let service: QueueServiceImpl;
  let configService: ConfigService;
  let executorBuilder: PaymentExecutorBuilder;
  let paymentsQueue: any;

  const mockExecutor = {
    statusCheck: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueServiceImpl,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'REDIS_HOST') return 'localhost';
              if (key === 'REDIS_PORT') return 6379;
              return null;
            }),
          },
        },
        {
          provide: PaymentExecutorBuilder,
          useValue: {
            getExecutor: jest.fn().mockReturnValue(mockExecutor),
          },
        },
        {
          provide: getQueueToken(QueueTYPE.PAYMENTS),
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QueueServiceImpl>(QueueServiceImpl);
    configService = module.get<ConfigService>(ConfigService);
    executorBuilder = module.get<PaymentExecutorBuilder>(
      PaymentExecutorBuilder,
    );
    paymentsQueue = module.get(getQueueToken(QueueTYPE.PAYMENTS));
  });

  afterEach(() => {
    jest.clearAllMocks();
    (Queue as unknown as jest.Mock).mockClear();
    (Worker as unknown as jest.Mock).mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize queues and worker', async () => {
      await service.onModuleInit();

      expect(Queue).toHaveBeenCalledWith(
        JobTYPE.PAYMENT_STATUS_CHECK,
        expect.any(Object),
      );
      expect(Worker).toHaveBeenCalledWith(
        JobTYPE.PAYMENT_STATUS_CHECK,
        expect.any(Function),
        expect.any(Object),
      );
    });
  });

  describe('addStatusCheckJob', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should add job to status check queue', async () => {
      const data = {
        transactionId: 'txn_123',
        partnerId: 'partner_1',
        channel: PaymentChannel.MPESA,
      };
      const options = { delay: 1000 };

      // Access private statusCheckQueue via 'any' cast
      const mockQueueInstance = (service as any).statusCheckQueue;

      await service.addStatusCheckJob(data, options);

      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        JobTYPE.PAYMENT_STATUS_CHECK,
        data,
        expect.objectContaining({
          delay: 1000,
          jobId: `status-check-${data.transactionId}`,
        }),
      );
    });
  });

  describe('processStatusCheckJob', () => {
    let mockQueueInstance: any;

    beforeEach(async () => {
      await service.onModuleInit();
      mockQueueInstance = (service as any).statusCheckQueue;
    });

    it('should process job and return result', async () => {
      const job = {
        data: {
          transactionId: 'txn_123',
          partnerId: 'partner_1',
          channel: PaymentChannel.MPESA,
        },
        attemptsMade: 0,
      };

      mockExecutor.statusCheck.mockResolvedValue({ status: 'completed' });

      const result = await (service as any).processStatusCheckJob(job);

      expect(executorBuilder.getExecutor).toHaveBeenCalledWith(
        'partner_1',
        PaymentChannel.MPESA,
      );
      expect(mockExecutor.statusCheck).toHaveBeenCalledWith('txn_123');
      expect(result).toEqual({ status: 'completed' });
    });

    it('should requeue job if status is pending and attempts < 5', async () => {
      const job = {
        data: {
          transactionId: 'txn_123',
          partnerId: 'partner_1',
          channel: PaymentChannel.MPESA,
        },
        attemptsMade: 0,
      };

      mockExecutor.statusCheck.mockResolvedValue({ status: 'pending' });

      await (service as any).processStatusCheckJob(job);

      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        JobTYPE.PAYMENT_STATUS_CHECK,
        job.data,
        expect.objectContaining({
          delay: 5000,
        }),
      );
    });

    it('should NOT requeue job if status is pending but attempts >= 5', async () => {
      const job = {
        data: {
          transactionId: 'txn_123',
          partnerId: 'partner_1',
          channel: PaymentChannel.MPESA,
        },
        attemptsMade: 5,
      };

      mockExecutor.statusCheck.mockResolvedValue({ status: 'pending' });

      mockQueueInstance.add.mockClear();

      await (service as any).processStatusCheckJob(job);

      expect(mockQueueInstance.add).not.toHaveBeenCalled();
    });
  });

  describe('getQueueStats', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return queue statistics', async () => {
      const stats = await service.getQueueStats();

      expect(stats).toEqual({
        waiting: 1,
        active: 2,
        completed: 3,
        failed: 4,
        total: 3,
      });
    });
  });
});
