import { Injectable } from '@nestjs/common';
import { RedisProvider } from '../database/redis.provider';
import { PaymentsCacheRepository } from 'src/domain/repositories/payments.redis.repository';
import { PaymentEntity as Payment } from 'src/domain/entities/payments.entity';

@Injectable()
export class PaymentsCacheRepositoryImpl implements PaymentsCacheRepository {
  constructor(private readonly redisProvider: RedisProvider) {}

  private get client() {
    return this.redisProvider.getClient();
  }

  async save(payment: Payment): Promise<void> {
    await this.client.set(
      `payment:${payment.transactionId}`,
      JSON.stringify(payment),
    );
  }

  async findByTransactionId(transactionId: string): Promise<Payment | null> {
    const data = await this.client.get(`payment:${transactionId}`);
    return data ? JSON.parse(data as string) : null;
  }

  async markProcessed(transactionId: string): Promise<void> {
    await this.client.set(`processed:${transactionId}`, 'true');
  }

  async isProcessed(transactionId: string): Promise<boolean> {
    return !!(await this.client.get(`processed:${transactionId}`));
  }
}
