import { PaymentEntity as Payment } from '../entities/payments.entity';

export interface PaymentRepository {
  save(payment: Payment): Promise<void>;
  findByTransactionId(transactionId: string): Promise<Payment | null>;
  markAsProcessed(transactionId: string): Promise<void>;
  updateStatus(transactionId: string, status: string): Promise<void>;
  isProcessed(transactionId: string): Promise<boolean>;
}
