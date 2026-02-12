import { Test, TestingModule } from '@nestjs/testing';
import { BritamMpesaExecutor } from './britam.mpesa.executor';
import { BritamMpesaChannel } from 'src/infrastructure/channels/partners/britam.mpesa.channel';
import { PaymentChannel } from 'src/shared/constants/payments';
import { PaymentRepositoryImpl } from '../../repositories/payments.postgres.repository';
import { QueueServiceImpl } from '../../queue/queue.service.impl';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { MetricsService } from '../../monitoring/metrics.service';

jest.mock('../../repositories/payments.postgres.repository', () => ({
  PaymentRepositoryImpl: class MockPaymentRepositoryImpl {},
}));

jest.mock('../../queue/queue.service.impl', () => ({
  QueueServiceImpl: class MockQueueServiceImpl {},
}));

jest.mock('../../rabbitmq/rabbitmq.service');

describe('BritamMpesaExecutor', () => {
  let executor: BritamMpesaExecutor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BritamMpesaExecutor,
        {
          provide: BritamMpesaChannel,
          useValue: {},
        },
        {
          provide: PaymentRepositoryImpl,
          useClass: PaymentRepositoryImpl,
        },
        {
          provide: QueueServiceImpl,
          useClass: QueueServiceImpl,
        },
        {
          provide: RabbitMQService,
          useValue: {},
        },
        {
          provide: 'AspinAdapter',
          useValue: { notifyPaymentStatus: jest.fn() },
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
      ],
    }).compile();

    executor = module.get<BritamMpesaExecutor>(BritamMpesaExecutor);
  });

  it('should be defined', () => {
    expect(executor).toBeDefined();
  });

  it('should return correct partner', () => {
    expect(executor.getPartner()).toBe('BRITAM');
  });

  it('should return correct channel', () => {
    expect(executor.getChannel()).toBe(PaymentChannel.MPESA);
  });
});
