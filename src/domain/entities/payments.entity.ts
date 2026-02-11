import { PaymentChannel } from 'src/shared/constants/payments';
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('payments')
export class PaymentEntity {
  @PrimaryColumn()
  transactionId: string;

  @Column()
  partner_id: string;

  @Column()
  channel: string | PaymentChannel;

  @Column()
  customerId: string;

  @Column('decimal')
  amount: number;

  @Column()
  currency: string;

  @Column()
  status: string;

  @Column()
  gateway: string;

  @Column({ default: false })
  processed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
