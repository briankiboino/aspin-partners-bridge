import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../repositories/payments.postgres.repository', () => ({
  PaymentRepositoryImpl: class MockPaymentRepositoryImpl {},
}));

jest.mock('../queue/queue.service.impl', () => ({
  QueueServiceImpl: class MockQueueServiceImpl {},
}));

import { BasePaymentExecutor } from './base.payment.executor';
import { PaymentRepositoryImpl } from '../repositories/payments.postgres.repository';
import { QueueServiceImpl } from '../queue/queue.service.impl';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { PaymentChannel } from 'src/shared/constants/payments';
import { IMpesaChannel } from 'src/application/interfaces/channel.interface';

class TestExecutor extends BasePaymentExecutor {
  getPartner(): string {
    return 'TEST_PARTNER';
  }
  getChannel(): PaymentChannel {
    return PaymentChannel.MPESA;
  }
  public getChannelImplementation(): IMpesaChannel {
    return this.channelImplementation;
  }

  constructor(
    repository: any,
    queue: any,
    rabbit: any,
    private channelImplementation: any,
  ) {
    super(repository, queue, rabbit);
  }
}

describe('BasePaymentExecutor', () => {
  let executor: TestExecutor;
  let paymentRepository: any;
  let queueService: any;
  let rabbitmqService: any;
  let mockChannel: any;

  beforeEach(async () => {
    paymentRepository = {
      findByReference: jest.fn(),
      create: jest.fn(),
      findByTransactionId: jest.fn(),
      updateStatus: jest.fn(),
    };

    queueService = {
      addStatusCheckJob: jest.fn(),
    };

    rabbitmqService = {
      publish: jest.fn(),
    };

    mockChannel = {
      stkPush: jest.fn(),
      queryTransaction: jest.fn(),
      loadConfig: jest.fn(),
      validateCallback: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PaymentRepositoryImpl,
          useValue: paymentRepository,
        },
        {
          provide: QueueServiceImpl,
          useValue: queueService,
        },
        {
          provide: RabbitMQService,
          useValue: rabbitmqService,
        },
        {
          provide: TestExecutor,
          useFactory: (repo, queue, rabbit) =>
            new TestExecutor(repo, queue, rabbit, mockChannel),
          inject: [PaymentRepositoryImpl, QueueServiceImpl, RabbitMQService],
        },
      ],
    }).compile();

    executor = module.get<TestExecutor>(TestExecutor);
  });

  describe('initiate', () => {
    const payload = {
      partnerId: 'TEST_PARTNER',
      customerId: '254700000000',
      amount: 100,
      currency: 'KES',
      reference: 'REF123',
      channel: PaymentChannel.MPESA,
    };

    it('should successfully initiate payment', async () => {
      paymentRepository.findByReference.mockResolvedValue(null);
      mockChannel.stkPush.mockResolvedValue({
        transactionId: 'TXN123',
        status: 'pending',
        timestamp: new Date().toISOString(),
      });

      const result = await executor.initiate(payload);

      expect(paymentRepository.findByReference).toHaveBeenCalledWith(
        payload.reference,
      );
      expect(mockChannel.stkPush).toHaveBeenCalled();
      expect(paymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'TXN123',
          status: 'pending',
          reference: payload.reference,
        }),
      );
      expect(queueService.addStatusCheckJob).toHaveBeenCalled();
      expect(result.transactionId).toBe('TXN123');
    });

    it('should throw error for duplicate transaction', async () => {
      paymentRepository.findByReference.mockResolvedValue({} as any);

      await expect(executor.initiate(payload)).rejects.toThrow(
        'Duplicate transaction attempt',
      );
    });
  });

  describe('statusCheck', () => {
    const transactionId = 'TXN123';

    it('should update status when changed', async () => {
      paymentRepository.findByTransactionId.mockResolvedValue({
        transactionId,
        status: 'pending',
        amount: 100,
        currency: 'KES',
      });

      mockChannel.queryTransaction.mockResolvedValue({
        status: 'completed',
      });

      const result = await executor.statusCheck(transactionId);

      expect(paymentRepository.updateStatus).toHaveBeenCalledWith(
        transactionId,
        'completed',
      );
      expect(result.status).toBe('completed');
    });

    it('should not update status when unchanged', async () => {
      paymentRepository.findByTransactionId.mockResolvedValue({
        transactionId,
        status: 'pending',
        amount: 100,
        currency: 'KES',
      });

      mockChannel.queryTransaction.mockResolvedValue({
        status: 'pending',
      });

      await executor.statusCheck(transactionId);

      expect(paymentRepository.updateStatus).not.toHaveBeenCalled();
    });
  });
});
