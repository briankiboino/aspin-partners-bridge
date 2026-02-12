import { Test, TestingModule } from '@nestjs/testing';
import { ApaMpesaExecutor } from './apa.mpesa.executor';
import { ApaMpesaChannel } from 'src/infrastructure/channels/partners/apa.mpesa.channel';
import { PaymentChannel } from 'src/shared/constants/payments';
import { PaymentRepositoryImpl } from '../../repositories/payments.postgres.repository';
import { QueueServiceImpl } from '../../queue/queue.service.impl';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';

jest.mock('../../repositories/payments.postgres.repository', () => ({
  PaymentRepositoryImpl: class MockPaymentRepositoryImpl {},
}));

jest.mock('../../queue/queue.service.impl', () => ({
  QueueServiceImpl: class MockQueueServiceImpl {},
}));

jest.mock('../../rabbitmq/rabbitmq.service');

describe('ApaMpesaExecutor', () => {
  let executor: ApaMpesaExecutor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApaMpesaExecutor,
        {
          provide: ApaMpesaChannel,
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
});
