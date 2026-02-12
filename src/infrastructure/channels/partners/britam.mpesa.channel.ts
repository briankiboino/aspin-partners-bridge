import { Injectable } from '@nestjs/common';
import { BaseMpesaChannel } from '../base/mpesa.base.channel';

@Injectable()
export class BritamMpesaChannel extends BaseMpesaChannel {}
