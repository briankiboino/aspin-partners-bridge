import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService, PaymentEvent } from './rabbitmq.service';
import * as amqp from 'amqplib';

jest.mock('amqplib');

describe('RabbitMQService', () => {
  let service: RabbitMQService;
  let configService: ConfigService;
  let mockConnection: any;
  let mockChannel: any;

  beforeEach(async () => {
    mockChannel = {
      assertExchange: jest.fn(),
      publish: jest.fn().mockReturnValue(true),
      close: jest.fn(),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      on: jest.fn(),
      close: jest.fn(),
    };

    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RabbitMQService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('amqp://localhost:5672'),
          },
        },
      ],
    }).compile();

    service = module.get<RabbitMQService>(RabbitMQService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect to RabbitMQ and setup exchange', async () => {
      await service.onModuleInit();

      expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost:5672');
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'payment.events',
        'topic',
        { durable: true },
      );
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      (amqp.connect as jest.Mock).mockRejectedValueOnce(error);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      jest.useFakeTimers();
      const connectPromise = service.onModuleInit();
      await connectPromise;

      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to connect to RabbitMQ:',
        error,
      );

      jest.useRealTimers();
    });
  });

  describe('publish', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should publish message to exchange', async () => {
      const exchange = 'payment.events';
      const routingKey = 'test.key';
      const message = { data: 'test' };

      const result = await service.publish(exchange, routingKey, message);

      expect(result).toBe(true);
      expect(mockChannel.publish).toHaveBeenCalledWith(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        expect.objectContaining({
          persistent: true,
          contentType: 'application/json',
        }),
      );
    });

    it('should return false if channel is not available', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RabbitMQService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('amqp://localhost:5672'),
            },
          },
        ],
      }).compile();
      const newService = module.get<RabbitMQService>(RabbitMQService);

      const result = await newService.publish('ex', 'key', {});
      expect(result).toBe(false);
    });

    it('should return false on publish error', async () => {
      mockChannel.publish.mockImplementation(() => {
        throw new Error('Publish error');
      });

      const result = await service.publish('ex', 'key', {});
      expect(result).toBe(false);
    });
  });

  describe('publish helper methods', () => {
    const event: PaymentEvent = {
      transaction_id: 'txn_123',
      partner_id: 'partner_1',
      channel: 'MPESA',
      amount: 100,
      currency: 'KES',
      status: 'completed',
      timestamp: new Date().toISOString(),
      customer_id: 'cust_1',
      reference: 'ref_1',
    };

    beforeEach(async () => {
      await service.onModuleInit();
      jest.spyOn(service, 'publish').mockResolvedValue(true);
    });

    it('should publish payment completed event', async () => {
      await service.publishPaymentCompleted(event);
      expect(service.publish).toHaveBeenCalledWith(
        'payment.events',
        `payment.completed.${event.partner_id}`,
        event,
      );
    });

    it('should publish payment failed event', async () => {
      await service.publishPaymentFailed(event);
      expect(service.publish).toHaveBeenCalledWith(
        'payment.events',
        `payment.failed.${event.partner_id}`,
        event,
      );
    });

    it('should publish payment pending event', async () => {
      await service.publishPaymentPending(event);
      expect(service.publish).toHaveBeenCalledWith(
        'payment.events',
        `payment.pending.${event.partner_id}`,
        event,
      );
    });
  });
});
