import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueServiceImpl } from './queue.service.impl';
import { PaymentExecutorBuilder } from '../executors/builder/payment.executor.builder';
import { QueueTYPE, JobTYPE } from 'src/shared/constants/queue';
import { PaymentChannel } from 'src/shared/constants/payments';
import { Queue, Worker } from 'bullmq';
import { MetricsService } from '../monitoring/metrics.service';
import { PaymentRepositoryImpl } from '../repositories/payments.postgres.repository';
import { TransactionNotFoundException } from 'src/shared/exceptions/payment.exceptions';

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
  let metricsService: MetricsService;
  let paymentRepository: any;

  const mockMpesaChannel = {
    stkPush: jest.fn(),
  } as any;

  const mockAirtelChannel = {
    directDebit: jest.fn(),
  } as any;

  const mockExecutor = {
    statusCheck: jest.fn(),
    initiate: jest.fn(),
    getChannelImplementation: jest.fn(() => mockMpesaChannel),
  } as any;

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
          provide: PaymentRepositoryImpl,
          useValue: {
            findByReference: jest.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            incrementApiCall: jest.fn(),
            incrementApiError4xx: jest.fn(),
            incrementApiError5xx: jest.fn(),
            incrementConnectionRefused: jest.fn(),
            incrementApiTimeout: jest.fn(),
          },
        },
        {
          provide: getQueueToken(QueueTYPE.PAYMENT_STATUS_CHECK),
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
    paymentsQueue = module.get(getQueueToken(QueueTYPE.PAYMENT_STATUS_CHECK));
    metricsService = module.get<MetricsService>(MetricsService);
    paymentRepository = module.get(PaymentRepositoryImpl);
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
        QueueTYPE.PAYMENT_STATUS_CHECK,
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

  describe('addPaymentInitiationJob', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should add job to payment initiation queue', async () => {
      const reference = 'ref-123';
      const options = { delay: 2000 };

      const mockQueueInstance = (service as any).paymentInitiationQueue;

      await service.addPaymentInitiationJob(reference, options);

      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        JobTYPE.PAYMENT_INITIATION,
        { reference },
        expect.objectContaining({
          delay: 2000,
          jobId: `payment-check-${reference}`,
        }),
      );
    });
  });

  describe('processPaymentInitiationJob', () => {
    const baseJob = {
      data: {
        reference: 'ref-123',
        partnerId: 'partner_1',
        channel: PaymentChannel.MPESA,
      },
    };

    beforeEach(async () => {
      await service.onModuleInit();
      mockExecutor.statusCheck.mockClear();
      mockExecutor.initiate.mockClear();
      mockExecutor.getChannelImplementation.mockClear();
      mockMpesaChannel.stkPush.mockClear();
      mockAirtelChannel.directDebit.mockClear();

      const paymentRepositoryMock = {
        findByReference: jest.fn(),
      };
      const metricsMock = {
        incrementApiCall: jest.fn(),
        incrementApiError4xx: jest.fn(),
        incrementApiError5xx: jest.fn(),
        incrementConnectionRefused: jest.fn(),
        incrementApiTimeout: jest.fn(),
      } as unknown as MetricsService;

      (service as any).paymentRepository = paymentRepositoryMock;
      (service as any).metricsService = metricsMock;
      paymentRepository = paymentRepositoryMock;
      metricsService = metricsMock;
    });

    it('should process MPESA payment initiation job and enqueue status check', async () => {
      paymentRepository.findByReference.mockResolvedValue({
        amount: 100,
        currency: 'KES',
        customerId: 'cust-1',
        phoneNumber: '254700000000',
        reference: 'ref-123',
      });
      mockExecutor.getChannelImplementation.mockReturnValue(mockMpesaChannel);
      mockMpesaChannel.stkPush.mockResolvedValue({
        transactionId: 'txn-mpesa-123',
        status: 'pending',
        amount: 100,
        currency: 'KES',
        timestamp: new Date().toISOString(),
      });
      const addStatusCheckJobSpy = jest
        .spyOn(service, 'addStatusCheckJob')
        .mockResolvedValue(undefined);

      await (service as any).processPaymentInitiationJob(baseJob);

      expect(executorBuilder.getExecutor).toHaveBeenCalledWith(
        'partner_1',
        PaymentChannel.MPESA,
      );
      expect(paymentRepository.findByReference).toHaveBeenCalledWith('ref-123');
      expect(metricsService.incrementApiCall).toHaveBeenCalledWith(
        'partner_1',
        PaymentChannel.MPESA,
      );
      expect(mockMpesaChannel.stkPush).toHaveBeenCalledWith({
        amount: 100,
        phoneNumber: '254700000000',
        accountReference: 'ref-123',
        partnerId: 'partner_1',
      });
      expect(addStatusCheckJobSpy).toHaveBeenCalledWith(
        {
          transactionId: 'txn-mpesa-123',
          partnerId: 'partner_1',
          channel: PaymentChannel.MPESA,
        },
        {
          delay: 10000,
        },
      );
    });

    it('should process AIRTEL payment initiation job and enqueue status check', async () => {
      const airtelJob = {
        data: {
          reference: 'ref-123',
          partnerId: 'partner_1',
          channel: PaymentChannel.AIRTEL,
        },
      };

      paymentRepository.findByReference.mockResolvedValue({
        amount: 200,
        currency: 'KES',
        customerId: 'cust-1',
        phoneNumber: '254711111111',
        reference: 'ref-123',
      });
      mockExecutor.getChannelImplementation.mockReturnValue(mockAirtelChannel);
      mockAirtelChannel.directDebit.mockResolvedValue({
        transactionId: 'txn-airtel-123',
        status: 'pending',
        amount: 200,
        currency: 'KES',
        timestamp: new Date().toISOString(),
      });
      const addStatusCheckJobSpy = jest
        .spyOn(service, 'addStatusCheckJob')
        .mockResolvedValue(undefined);

      await (service as any).processPaymentInitiationJob(airtelJob);

      expect(executorBuilder.getExecutor).toHaveBeenCalledWith(
        'partner_1',
        PaymentChannel.AIRTEL,
      );
      expect(paymentRepository.findByReference).toHaveBeenCalledWith('ref-123');
      expect(metricsService.incrementApiCall).toHaveBeenCalledWith(
        'partner_1',
        PaymentChannel.AIRTEL,
      );
      expect(mockAirtelChannel.directDebit).toHaveBeenCalledWith({
        amount: 200,
        phoneNumber: '254711111111',
        reference: 'ref-123',
        partnerId: 'partner_1',
      });
      expect(addStatusCheckJobSpy).toHaveBeenCalledWith(
        {
          transactionId: 'txn-airtel-123',
          partnerId: 'partner_1',
          channel: PaymentChannel.AIRTEL,
        },
        {
          delay: 10000,
        },
      );
    });

    it('should throw TransactionNotFoundException when payment order is missing', async () => {
      paymentRepository.findByReference.mockResolvedValue(null);

      await expect(
        (service as any).processPaymentInitiationJob(baseJob),
      ).rejects.toBeInstanceOf(TransactionNotFoundException);
    });

    it('should record 4xx API error metrics and rethrow', async () => {
      paymentRepository.findByReference.mockResolvedValue({
        amount: 100,
        currency: 'KES',
        customerId: 'cust-1',
        phoneNumber: '254700000000',
        reference: 'ref-123',
      });
      const error = { response: { status: 400 } };
      mockExecutor.getChannelImplementation.mockReturnValue(mockMpesaChannel);
      mockMpesaChannel.stkPush.mockRejectedValue(error);

      await expect(
        (service as any).processPaymentInitiationJob(baseJob),
      ).rejects.toBe(error as any);

      expect(metricsService.incrementApiError4xx).toHaveBeenCalledWith(
        'partner_1',
        PaymentChannel.MPESA,
        400,
      );
      expect(metricsService.incrementApiError5xx).not.toHaveBeenCalled();
    });

    it('should record 5xx API error metrics and rethrow', async () => {
      paymentRepository.findByReference.mockResolvedValue({
        amount: 100,
        currency: 'KES',
        customerId: 'cust-1',
        phoneNumber: '254700000000',
        reference: 'ref-123',
      });
      const error = { response: { status: 500 } };
      mockExecutor.getChannelImplementation.mockReturnValue(mockMpesaChannel);
      mockMpesaChannel.stkPush.mockRejectedValue(error);

      await expect(
        (service as any).processPaymentInitiationJob(baseJob),
      ).rejects.toBe(error as any);

      expect(metricsService.incrementApiError5xx).toHaveBeenCalledWith(
        'partner_1',
        PaymentChannel.MPESA,
        500,
      );
      expect(metricsService.incrementApiError4xx).not.toHaveBeenCalled();
    });

    it('should record connection refused metrics and rethrow', async () => {
      paymentRepository.findByReference.mockResolvedValue({
        amount: 100,
        currency: 'KES',
        customerId: 'cust-1',
        phoneNumber: '254700000000',
        reference: 'ref-123',
      });
      const error = { code: 'ECONNREFUSED' };
      mockExecutor.getChannelImplementation.mockReturnValue(mockMpesaChannel);
      mockMpesaChannel.stkPush.mockRejectedValue(error);

      await expect(
        (service as any).processPaymentInitiationJob(baseJob),
      ).rejects.toBe(error as any);

      expect(metricsService.incrementConnectionRefused).toHaveBeenCalledWith(
        'partner_1',
        PaymentChannel.MPESA,
      );
    });

    it('should record timeout metrics and rethrow', async () => {
      paymentRepository.findByReference.mockResolvedValue({
        amount: 100,
        currency: 'KES',
        customerId: 'cust-1',
        phoneNumber: '254700000000',
        reference: 'ref-123',
      });
      const error = { code: 'ETIMEDOUT' };
      mockExecutor.getChannelImplementation.mockReturnValue(mockMpesaChannel);
      mockMpesaChannel.stkPush.mockRejectedValue(error);

      await expect(
        (service as any).processPaymentInitiationJob(baseJob),
      ).rejects.toBe(error as any);

      expect(metricsService.incrementApiTimeout).toHaveBeenCalledWith(
        'partner_1',
        PaymentChannel.MPESA,
      );
    });
  });
});
