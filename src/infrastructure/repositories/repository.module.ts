import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from '../../domain/entities/payments.entity';
import { PartnerConfigurationEntity } from '../../domain/entities/partner.configuration.entity';
import { PaymentRepositoryImpl } from './payments.postgres.repository';
import { PartnerConfigurationsRepositoryImpl } from './partner.configurations.repository';
import { ServiceModule } from '../services/service.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([PaymentEntity, PartnerConfigurationEntity]),
    ServiceModule,
  ],
  providers: [
    PaymentRepositoryImpl,
    {
      provide: 'PaymentRepository',
      useExisting: PaymentRepositoryImpl,
    },
    {
      provide: 'PartnerConfigurationsRepository',
      useClass: PartnerConfigurationsRepositoryImpl,
    },
  ],
  exports: [
    PaymentRepositoryImpl,
    'PaymentRepository',
    'PartnerConfigurationsRepository',
  ],
})
export class RepositoryModule {}
