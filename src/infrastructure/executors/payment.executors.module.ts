import { Module, forwardRef } from '@nestjs/common';
import { PaymentExecutorBuilder } from './builder/payment.executor.builder';
import { BritamMpesaExecutor } from './partners/britam.mpesa.executor';
import { ApaMpesaExecutor } from './partners/apa.mpesa.executor';
import { BritamAirtelExecutor } from './partners/britam.airtel.executor';
import { ChannelsModule } from '../channels/channels.module';
import { RepositoryModule } from '../repositories/repository.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { BullMQModule } from '../queue/bullmq.module';
import { AdaptersModule } from '../adapters/adapters.module';
import { RedisModule } from '../database/redis.module';

@Module({
  imports: [
    ChannelsModule,
    RepositoryModule,
    RabbitMQModule,
    forwardRef(() => BullMQModule),
    AdaptersModule,
    RedisModule,
  ],
  providers: [
    PaymentExecutorBuilder,
    BritamMpesaExecutor,
    ApaMpesaExecutor,
    BritamAirtelExecutor,
  ],
  exports: [
    PaymentExecutorBuilder,
    BritamMpesaExecutor,
    ApaMpesaExecutor,
    BritamAirtelExecutor,
  ],
})
export class PaymentExecutorsModule {}
