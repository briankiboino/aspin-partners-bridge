import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsProcessor } from './payments.processor';
import { RedisProvider } from '../database/redis.provider';
import { PaymentRepository } from '../repositories/payments.repository.pg';
import { PaymentRepositoryRedis } from '../repositories/payments.repository.redis';
import { PaymentHubAdapterImpl } from '../adapters/paymenthub.adapter.impl';
import { AspinAdapter } from '../../application/interfaces/aspin.adapter.interface';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'payments',
    }),
  ],
  providers: [
    PaymentsProcessor,
    RedisProvider,
    PaymentRepository,
    PaymentRepositoryRedis,
    PaymentHubAdapterImpl,
    AspinAdapter,
  ],
  exports: [BullModule],
})
export class BullMQModule {}
