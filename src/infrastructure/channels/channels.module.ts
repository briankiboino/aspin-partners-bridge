import { Module } from '@nestjs/common';
import { BaseMpesaChannel } from './base/mpesa.base.channel';
import { BaseAirtelChannel } from './base/airtel.base.channel';
import { BritamMpesaChannel } from './partners/britam.mpesa.channel';
import { ApaMpesaChannel } from './partners/apa.mpesa.channel';
import { BritamAirtelChannel } from './partners/britam.airtel.channel';
import { AdaptersModule } from '../adapters/adapters.module';
import { RepositoryModule } from '../repositories/repository.module';

@Module({
  imports: [AdaptersModule, RepositoryModule],
  providers: [
    BritamMpesaChannel,
    ApaMpesaChannel,
    BritamAirtelChannel,
    {
      provide: BaseMpesaChannel,
      useClass: BritamMpesaChannel,
    },
    {
      provide: BaseAirtelChannel,
      useClass: BritamAirtelChannel,
    },
  ],
  exports: [
    BritamMpesaChannel,
    ApaMpesaChannel,
    BritamAirtelChannel,
    BaseMpesaChannel,
    BaseAirtelChannel,
  ],
})
export class ChannelsModule {}