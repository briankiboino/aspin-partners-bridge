import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { BasePaymentExecutor } from '../base.payment.executor';
import { PaymentChannel } from 'src/shared/constants/payments';
import { BritamAirtelChannel } from 'src/infrastructure/channels/partners/britam.airtel.channel';
import { RabbitMQService } from 'src/infrastructure/rabbitmq/rabbitmq.service';
import { PaymentRepository } from 'src/domain/repositories/payments.postgres.repository';
import { QueueService } from 'src/application/interfaces/queue.interface';
import { PaymentRepositoryImpl } from '../../repositories/payments.postgres.repository';
import { QueueServiceImpl } from '../../queue/queue.service.impl';
import { AspinAdapter } from 'src/application/interfaces/aspin.adapter.interface';
import { MetricsService } from '../../monitoring/metrics.service';
import { ConfigService } from '@nestjs/config';
import { RedisProvider } from '../../database/redis.provider';

@Injectable()
export class BritamAirtelExecutor extends BasePaymentExecutor {
  constructor(
    @Inject(PaymentRepositoryImpl) paymentRepository: PaymentRepository,
    @Inject(forwardRef(() => QueueServiceImpl)) queueService: QueueService,
    rabbitmqService: RabbitMQService,
    @Inject('AspinAdapter') aspinAdapter: AspinAdapter,
    metricsService: MetricsService,
    private readonly britamAirtelChannel: BritamAirtelChannel,
    configService: ConfigService,
    redisProvider: RedisProvider,
  ) {
    super(
      paymentRepository,
      queueService,
      rabbitmqService,
      aspinAdapter,
      metricsService,
      configService,
      redisProvider,
    );
  }

  getPartner(): string {
    return 'BRITAM';
  }

  getChannel(): PaymentChannel {
    return PaymentChannel.AIRTEL;
  }

  getChannelImplementation() {
    return this.britamAirtelChannel;
  }
}
