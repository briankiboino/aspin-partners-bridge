import { PaymentChannel } from 'src/shared/constants/payments';
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('partner_configurations')
export class PartnerConfigurationEntity {
  @PrimaryColumn()
  partnerId: string;

  @PrimaryColumn()
  channel: PaymentChannel;

  @Column('jsonb')
  config: Record<string, any>;
}
