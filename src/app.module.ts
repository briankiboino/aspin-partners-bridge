import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './presentation/controllers/health.check.controller';
import { PaymentsModule } from './payments.module';
import { MonitoringModule } from './infrastructure/monitoring/monitoring.module';
import { SentryFilter } from './infrastructure/monitoring/sentry.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TerminusModule,
    PaymentsModule,
    MonitoringModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryFilter,
    },
  ],
})
export class AppModule {}
