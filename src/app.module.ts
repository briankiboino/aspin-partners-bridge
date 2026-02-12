import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './presentation/controllers/health.check.controller';
import { PaymentsModule } from './payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TerminusModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
