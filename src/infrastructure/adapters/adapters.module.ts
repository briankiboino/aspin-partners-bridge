import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PaymentHubAdapterImpl } from './paymenthub.adapter';
import { AspinAdapterImpl } from './aspin.adapter';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    {
      provide: 'PaymentHubAdapter',
      useClass: PaymentHubAdapterImpl,
    },
    {
      provide: 'AspinAdapter',
      useClass: AspinAdapterImpl,
    },
  ],
  exports: ['PaymentHubAdapter', 'AspinAdapter'],
})
export class AdaptersModule {}