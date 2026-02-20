import { PaymentChannel } from 'src/shared/constants/payments';

interface JobData {
  partnerId: string;
  channel: PaymentChannel;
}
export interface StatusCheckJobData extends JobData {
  transactionId: string;
}

export interface PaymentInitiationJobData extends JobData {
  reference: string;
}

export interface StatusCheckJobOptions {
  delay?: number;
}

export interface QueueService {
  addStatusCheckJob(
    data: StatusCheckJobData,
    options?: StatusCheckJobOptions,
  ): Promise<void>;
  getQueueStats(): Promise<any>;
  close(): Promise<void>;
  addPaymentInitiationJob(
    reference: string,
    options?: StatusCheckJobOptions,
  ): Promise<void>;
}
