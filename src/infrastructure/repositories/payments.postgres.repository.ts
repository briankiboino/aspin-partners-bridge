import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import { PaymentRepository } from '../../domain/repositories/payments.repository';
import { PaymentEntity as Payment } from 'src/domain/entities/payments.entity';

@Injectable()
export class PaymentRepositoryImpl implements PaymentRepository {
  private repository: Repository<Payment>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Payment);
  }

  async save(payment: Payment): Promise<void> {
    await this.repository.save({
      transactionId: payment.transactionId,
      customerId: payment.customerId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      gateway: payment.gateway,
      processed: payment.processed || false,
    });
  }

  async findByTransactionId(id: string): Promise<Payment | null> {
    const result = await this.repository.findOneBy({ transactionId: id });
    if (!result) return null;

    return result;
  }

  async markAsProcessed(id: string): Promise<void> {
    await this.repository.update({ transactionId: id }, { processed: true });
  }

  async isProcessed(id: string): Promise<boolean> {
    const result = await this.repository.findOneBy({ transactionId: id });
    return !!result?.processed;
  }
}
