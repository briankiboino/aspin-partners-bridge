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
import { PaymentChannel } from '../../shared/constants/payments';
import {
  IMpesaChannel,
  IAirtelChannel,
} from '../../application/interfaces/channel.interface';

class TestExecutor extends BasePaymentExecutor {
  public channelType: PaymentChannel = PaymentChannel.MPESA;

  getPartner(): string {
    return 'TEST_PARTNER';
  }
  getChannel(): PaymentChannel {
    return this.channelType;
  }
  public getChannelImplementation(): IMpesaChannel | IAirtelChannel {
    return this.channelImplementation;
  }

  constructor(
    repository: any,
    queue: any,
    rabbit: any,
    aspin: any,
    private channelImplementation: any,
  ) {
    super(repository, queue, rabbit, aspin);
  }
}

describe('BasePaymentExecutor', () => {
  let executor: TestExecutor;
  let paymentRepository: any;
  let queueService: any;
  let rabbitmqService: any;
  let aspinAdapter: any;
  let mockChannel: any;

  beforeEach(async () => {
    paymentRepository = {
      findByReference: jest.fn(),
      create: jest.fn(),
      findByTransactionId: jest.fn(),
      updateStatus: jest.fn(),
      update: jest.fn(),
    };

    queueService = {
      addStatusCheckJob: jest.fn(),
    };

    rabbitmqService = {
      publish: jest.fn(),
    };

    aspinAdapter = {
      notifyPaymentStatus: jest.fn(),
    };

    mockChannel = {
      stkPush: jest.fn(),
      directDebit: jest.fn(),
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
          provide: 'AspinAdapter',
          useValue: aspinAdapter,
        },
        {
          provide: TestExecutor,
          useFactory: (repo, queue, rabbit, aspin) =>
            new TestExecutor(repo, queue, rabbit, aspin, mockChannel),
          inject: [
            PaymentRepositoryImpl,
            QueueServiceImpl,
            RabbitMQService,
            'AspinAdapter',
          ],
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

    describe('MPESA', () => {
      it('should successfully initiate payment via MPESA', async () => {
        executor.channelType = PaymentChannel.MPESA;
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
        expect(mockChannel.stkPush).toHaveBeenCalledWith({
          phoneNumber: payload.customerId,
          amount: payload.amount,
          accountReference: payload.reference,
          transactionDesc: `Payment for TEST_PARTNER`,
          partnerId: payload.partnerId,
        });
        expect(paymentRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            transactionId: 'TXN123',
            status: 'pending',
            reference: payload.reference,
            channel: PaymentChannel.MPESA,
          }),
        );
        expect(queueService.addStatusCheckJob).toHaveBeenCalled();
        expect(result.transactionId).toBe('TXN123');
      });
    });

    describe('AIRTEL', () => {
      it('should successfully initiate payment via AIRTEL', async () => {
        executor.channelType = PaymentChannel.AIRTEL;
        const airtelPayload = { ...payload, channel: PaymentChannel.AIRTEL };

        paymentRepository.findByReference.mockResolvedValue(null);
        mockChannel.directDebit.mockResolvedValue({
          transactionId: 'AIRTEL_TXN_123',
          status: 'pending',
          timestamp: new Date().toISOString(),
        });

        const result = await executor.initiate(airtelPayload);

        expect(paymentRepository.findByReference).toHaveBeenCalledWith(
          airtelPayload.reference,
        );
        expect(mockChannel.directDebit).toHaveBeenCalledWith({
          phoneNumber: airtelPayload.customerId,
          amount: airtelPayload.amount,
          reference: airtelPayload.reference,
          partnerId: airtelPayload.partnerId,
        });
        expect(paymentRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            transactionId: 'AIRTEL_TXN_123',
            status: 'pending',
            reference: airtelPayload.reference,
            channel: PaymentChannel.AIRTEL,
          }),
        );
        expect(result.transactionId).toBe('AIRTEL_TXN_123');
      });
    });

    describe('Error Handling', () => {
      it('should throw error for duplicate transaction', async () => {
        paymentRepository.findByReference.mockResolvedValue({} as any);

        await expect(executor.initiate(payload)).rejects.toThrow(
          'Duplicate transaction attempt',
        );
      });

      it('should handle channel failure', async () => {
        executor.channelType = PaymentChannel.MPESA;
        paymentRepository.findByReference.mockResolvedValue(null);
        mockChannel.stkPush.mockRejectedValue(new Error('Channel Error'));

        await expect(executor.initiate(payload)).rejects.toThrow(
          'Channel Error',
        );
        expect(paymentRepository.create).not.toHaveBeenCalled();
      });

      it('should handle repository failure during creation', async () => {
        executor.channelType = PaymentChannel.MPESA;
        paymentRepository.findByReference.mockResolvedValue(null);
        mockChannel.stkPush.mockResolvedValue({
          transactionId: 'TXN123',
          status: 'pending',
        });
        paymentRepository.create.mockRejectedValue(new Error('DB Error'));

        await expect(executor.initiate(payload)).rejects.toThrow('DB Error');
      });
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
      expect(aspinAdapter.notifyPaymentStatus).toHaveBeenCalled();
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

    describe('Error Handling', () => {
      it('should throw error if transaction not found', async () => {
        paymentRepository.findByTransactionId.mockResolvedValue(null);

        await expect(executor.statusCheck('NON_EXISTENT')).rejects.toThrow(
          'Transaction not found',
        );
      });

      it('should throw error on unknown status format', async () => {
        paymentRepository.findByTransactionId.mockResolvedValue({
          transactionId,
          status: 'pending',
        });
        mockChannel.queryTransaction.mockResolvedValue({
          unknownField: 'something',
        });

        await expect(executor.statusCheck(transactionId)).rejects.toThrow(
          'Unknown status response format',
        );
      });
    });
  });

  describe('handleCallback', () => {
    const transactionId = 'TXN_CALLBACK_123';
    const payload = {
      transaction_id: transactionId,
      status: 'completed',
    };

    beforeEach(() => {
      mockChannel.loadConfig.mockResolvedValue({
        config: { webhookSecret: 'secret' },
      });
      mockChannel.validateCallback.mockReturnValue(true);
    });

    it('should process valid callback successfully', async () => {
      paymentRepository.findByTransactionId.mockResolvedValue({
        transactionId,
        status: 'pending',
        amount: 100,
        currency: 'KES',
        processed: false,
      });

      const result = await executor.handleCallback(payload);

      expect(paymentRepository.update).toHaveBeenCalledWith(transactionId, {
        status: 'completed',
        processed: true,
      });
      expect(rabbitmqService.publish).toHaveBeenCalled();
      expect(aspinAdapter.notifyPaymentStatus).toHaveBeenCalled();
      expect(result.status).toBe('completed');
    });

    it('should throw error if transaction not found', async () => {
      paymentRepository.findByTransactionId.mockResolvedValue(null);

      await expect(executor.handleCallback(payload)).rejects.toThrow(
        'Transaction not found',
      );
    });

    it('should return processed status for duplicate callback', async () => {
      paymentRepository.findByTransactionId.mockResolvedValue({
        transactionId,
        status: 'completed',
        processed: true,
        updatedAt: new Date(),
      });

      const result = await executor.handleCallback(payload);

      expect(result.isValid).toBe(true);
      expect(paymentRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for invalid signature', async () => {
      paymentRepository.findByTransactionId.mockResolvedValue({
        transactionId,
        status: 'pending',
      });
      mockChannel.validateCallback.mockReturnValue(false);

      await expect(executor.handleCallback(payload)).rejects.toThrow(
        'Invalid callback signature',
      );
    });
  });
});
