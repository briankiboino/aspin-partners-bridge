import { Test, TestingModule } from '@nestjs/testing';
import { BritamAirtelExecutor } from './britam.airtel.executor';
import { BritamAirtelChannel } from 'src/infrastructure/channels/partners/britam.airtel.channel';
import { PaymentChannel } from 'src/shared/constants/payments';
import { PaymentRepositoryImpl } from '../../repositories/payments.postgres.repository';
import { QueueServiceImpl } from '../../queue/queue.service.impl';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { MetricsService } from '../../monitoring/metrics.service';
import { ConfigService } from '@nestjs/config';

jest.mock('../../repositories/payments.postgres.repository', () => ({
  PaymentRepositoryImpl: class MockPaymentRepositoryImpl {},
}));

jest.mock('../../queue/queue.service.impl', () => ({
  QueueServiceImpl: class MockQueueServiceImpl {},
}));

jest.mock('../../rabbitmq/rabbitmq.service');

describe('BritamAirtelExecutor', () => {
  let executor: BritamAirtelExecutor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BritamAirtelExecutor,
        {
          provide: BritamAirtelChannel,
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
          useValue: {
            publish: jest.fn(),
            publishPaymentCompleted: jest.fn(),
            publishPaymentFailed: jest.fn(),
            publishPaymentPending: jest.fn(),
          },
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
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    executor = module.get<BritamAirtelExecutor>(BritamAirtelExecutor);
  });

  it('should be defined', () => {
    expect(executor).toBeDefined();
  });

  it('should return correct partner', () => {
    expect(executor.getPartner()).toBe('BRITAM');
  });

  it('should return correct channel', () => {
    expect(executor.getChannel()).toBe(PaymentChannel.AIRTEL);
  });
});
