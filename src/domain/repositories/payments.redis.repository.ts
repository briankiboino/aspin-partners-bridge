import { PaymentEntity as Payment } from '../entities/payments.entity';

export interface PaymentsCacheRepository {
  save(payment: Payment): Promise<void>;
  isProcessed(transactionId: string): Promise<boolean>;
  markProcessed(transactionId: string): Promise<void>;
  findByTransactionId(transactionId: string): Promise<Payment | null>;
}
