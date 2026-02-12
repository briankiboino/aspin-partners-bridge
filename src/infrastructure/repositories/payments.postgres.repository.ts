import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import { PaymentRepository } from '../../domain/repositories/payments.postgres.repository';
import { PaymentEntity as Payment } from 'src/domain/entities/payments.entity';

@Injectable()
export class PaymentRepositoryImpl implements PaymentRepository {
  private repository: Repository<Payment>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Payment);
  }

  async save(payment: Payment): Promise<void> {
    await this.repository.save(payment);
  }

  async create(payment: Partial<Payment>): Promise<void> {
    await this.repository.save(payment);
  }

  async findByTransactionId(id: string): Promise<Payment | null> {
    const result = await this.repository.findOneBy({ transactionId: id });
    if (!result) return null;

    return result;
  }

  async findByReference(reference: string): Promise<Payment | null> {
    return this.repository.findOneBy({ reference });
  }

  async markAsProcessed(id: string): Promise<void> {
    await this.repository.update({ transactionId: id }, { processed: true });
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.repository.update({ transactionId: id }, { status });
  }

  async update(transactionId: string, data: Partial<Payment>): Promise<void> {
    await this.repository.update({ transactionId }, data);
  }

  async isProcessed(id: string): Promise<boolean> {
    const result = await this.repository.findOneBy({ transactionId: id });
    return !!result?.processed;
  }
}
