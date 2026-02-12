import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Worker, Job } from 'bullmq';
import { PaymentExecutorBuilder } from '../executors/builder/payment.executor.builder';
import { JobTYPE, QueueTYPE } from 'src/shared/constants/queue';
import {
  QueueService,
  StatusCheckJobData,
  StatusCheckJobOptions,
} from 'src/application/interfaces/queue.interface';

@Injectable()
export class QueueServiceImpl implements OnModuleInit, QueueService {
  private readonly logger = new Logger(QueueServiceImpl.name);
  private statusCheckQueue: Queue;
  private statusCheckWorker: Worker;

  constructor(
    @Inject(forwardRef(() => PaymentExecutorBuilder))
    private readonly executorFactory: PaymentExecutorBuilder,
    private readonly configService: ConfigService,
    @InjectQueue(QueueTYPE.PAYMENTS) private readonly paymentsQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.initializeQueues();
  }

  private async initializeQueues(): Promise<void> {
    const connection = {
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
    };

    this.statusCheckQueue = new Queue(JobTYPE.PAYMENT_STATUS_CHECK, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });

    this.statusCheckWorker = new Worker(
      JobTYPE.PAYMENT_STATUS_CHECK,
      async (job: Job) => {
        return this.processStatusCheckJob(job);
      },
      {
        connection,
        concurrency: 10,
      },
    );

    this.statusCheckWorker.on('completed', (job) => {
      this.logger.log(`Status check job completed: ${job.id}`);
    });

    this.statusCheckWorker.on('failed', (job, error) => {
      this.logger.error(`Status check job failed: ${job.id}`, error.stack);
    });

    this.logger.log('BullMQ queues initialized');
  }

  async addStatusCheckJob(
    data: StatusCheckJobData,
    options?: StatusCheckJobOptions,
  ): Promise<void> {
    const delay = options?.delay || 5000;

    await this.statusCheckQueue.add(JobTYPE.PAYMENT_STATUS_CHECK, data, {
      delay,
      jobId: `status-check-${data.transactionId}`,
    });

    this.logger.log(
      `Added status check job for transaction ${data.transactionId} with ${delay}ms delay`,
    );
  }

  private async processStatusCheckJob(job: Job): Promise<any> {
    const { transactionId, partnerId, channel } =
      job.data as StatusCheckJobData;

    this.logger.log(
      `Processing status check for transaction: ${transactionId}`,
    );

    try {
      const executor = this.executorFactory.getExecutor(partnerId, channel);

      const result = await executor.statusCheck(transactionId);

      this.logger.log(
        `Status check result for ${transactionId}: ${result.status}`,
      );

      if (result.status === 'pending' && job.attemptsMade < 5) {
        await this.addStatusCheckJob(job.data, {
          delay: 5000 * (job.attemptsMade + 1),
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`Status check failed for ${transactionId}:`, error);
      throw error;
    }
  }

  async getQueueStats() {
    const waiting = await this.statusCheckQueue.getWaitingCount();
    const active = await this.statusCheckQueue.getActiveCount();
    const completed = await this.statusCheckQueue.getCompletedCount();
    const failed = await this.statusCheckQueue.getFailedCount();

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active,
    };
  }

  async close(): Promise<void> {
    await this.statusCheckWorker?.close();
    await this.statusCheckQueue?.close();
    this.logger.log('Queues closed');
  }
}
