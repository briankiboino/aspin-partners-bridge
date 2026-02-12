import { PaymentEntity as Payment } from '../entities/payments.entity';

export interface PaymentRepository {
  save(payment: Payment): Promise<void>;
  create(payment: Partial<Payment>): Promise<void>;
  findByTransactionId(transactionId: string): Promise<Payment | null>;
  findByReference(reference: string): Promise<Payment | null>;
  markAsProcessed(transactionId: string): Promise<void>;
  updateStatus(transactionId: string, status: string): Promise<void>;
  update(transactionId: string, data: Partial<Payment>): Promise<void>;
  isProcessed(transactionId: string): Promise<boolean>;
}
