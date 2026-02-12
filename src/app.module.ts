import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { RepositoryModule } from './infrastructure/repositories/repository.module';
import { AdaptersModule } from './infrastructure/adapters/adapters.module';
import { ChannelsModule } from './infrastructure/channels/channels.module';
import { PaymentExecutorsModule } from './infrastructure/executors/payment.executors.module';
import { BullMQModule } from './infrastructure/queue/bullmq.module';
import { RabbitMQModule } from './infrastructure/rabbitmq/rabbitmq.module';
import { PaymentsController } from './presentation/controllers/payments.controller';
import { PaymentsUseCaseImpl } from './application/usecases/payments.usecase';
import { PaymentExecutorBuilder } from './infrastructure/executors/builder/payment.executor.builder';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    RepositoryModule,
    AdaptersModule,
    ChannelsModule,
    PaymentExecutorsModule,
    BullMQModule,
    RabbitMQModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsUseCaseImpl,
    {
      provide: 'PaymentsUseCase',
      useExisting: PaymentsUseCaseImpl,
    },
    {
      provide: 'PaymentExecutorBuilder',
      useExisting: PaymentExecutorBuilder,
    },
  ],
})
export class AppModule {}
