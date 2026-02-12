import { PaymentChannel } from 'src/shared/constants/payments';

export interface StatusCheckJobData {
  transactionId: string;
  partnerId: string;
  channel: PaymentChannel;
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
}
