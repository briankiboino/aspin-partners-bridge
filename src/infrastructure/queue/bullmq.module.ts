import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from '../database/redis.module';
import { RedisProvider } from '../database/redis.provider';
import { QueueServiceImpl } from './queue.service.impl';
import { QueueTYPE } from 'src/shared/constants/queue';
import { RepositoryModule } from '../repositories/repository.module';
import { AdaptersModule } from '../adapters/adapters.module';
import { PaymentExecutorsModule } from '../executors/payment.executors.module';

@Module({
  imports: [
    RedisModule,
    RepositoryModule,
    AdaptersModule,
    forwardRef(() => PaymentExecutorsModule),
    BullModule.forRootAsync({
      imports: [RedisModule],
      useFactory: async (redisProvider: RedisProvider) => ({
        connection: redisProvider.getRedisOptions(),
      }),
      inject: [RedisProvider],
    }),
    BullModule.registerQueue({
      name: QueueTYPE.PAYMENTS,
    }),
  ],
  providers: [
    QueueServiceImpl,
    {
      provide: 'QueueService',
      useExisting: QueueServiceImpl,
    },
  ],
  exports: [BullModule, QueueServiceImpl, 'QueueService'],
})
export class BullMQModule {}
