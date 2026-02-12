import { Injectable } from '@nestjs/common';
import { BaseAirtelChannel } from '../base/airtel.base.channel';

@Injectable()
export class BritamAirtelChannel extends BaseAirtelChannel {}
