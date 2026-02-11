import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsProcessor } from './payments.processor';
import { RedisProvider } from '../database/redis.provider';
import { PaymentRepositoryImpl } from '../repositories/payments.postgres.repository';
import { PaymentsCacheRepositoryImpl } from '../repositories/payments.redis.repository';
import { PaymentHubAdapterImpl } from '../adapters/paymenthub.adapter';
import { AspinAdapterImpl } from '../adapters/aspin.adapter';
import { QueueServiceImpl } from './queue.service';
import { MockSecretsManagerService } from '../services/secrets.manager.service';
import { PartnerConfigurationsRepositoryImpl } from '../repositories/partner.configurations.repository';

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
    PaymentRepositoryImpl,
    PaymentsCacheRepositoryImpl,
    {
      provide: 'PaymentHubAdapter',
      useClass: PaymentHubAdapterImpl,
    },
    {
      provide: 'AspinAdapter',
      useClass: AspinAdapterImpl,
    },
    {
      provide: 'QueueService',
      useClass: QueueServiceImpl,
    },
    {
      provide: 'SecretsManager',
      useClass: MockSecretsManagerService,
    },
    {
      provide: 'PartnerConfigurationsRepository',
      useClass: PartnerConfigurationsRepositoryImpl,
    },
  ],
  exports: [
    BullModule,
    'QueueService',
    'PaymentHubAdapter',
    'AspinAdapter',
    'PartnerConfigurationsRepository',
  ],
})
export class BullMQModule {}
