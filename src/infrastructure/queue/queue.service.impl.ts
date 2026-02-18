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
  PaymentInitiationJobData,
  QueueService,
  StatusCheckJobData,
  StatusCheckJobOptions,
} from 'src/application/interfaces/queue.interface';
import { PaymentRepository } from 'src/domain/repositories/payments.postgres.repository';
import { PaymentRepositoryImpl } from '../repositories/payments.postgres.repository';
import { MetricsService } from '../monitoring/metrics.service';
import { TransactionNotFoundException } from 'src/shared/exceptions/payment.exceptions';
import { PaymentChannel } from 'src/shared/constants/payments';
import {
  IAirtelChannel,
  IMpesaChannel,
} from 'src/application/interfaces/channel.interface';
import {
  AirtelDirectDebitResponse,
  MpesaStkPushResponse,
} from 'src/application/dto/payments/channel.dto';

@Injectable()
export class QueueServiceImpl implements OnModuleInit, QueueService {
  private readonly logger = new Logger(QueueServiceImpl.name);
  private statusCheckQueue: Queue;
  private statusCheckWorker: Worker;
  private paymentInitiationQueue: Queue;
  private paymentInitiationWorker: Worker;

  constructor(
    @Inject(forwardRef(() => PaymentExecutorBuilder))
    private readonly executorFactory: PaymentExecutorBuilder,
    private readonly configService: ConfigService,
    @InjectQueue(QueueTYPE.PAYMENT_STATUS_CHECK)
    @InjectQueue(QueueTYPE.PAYMENT_INITIATION)
    @Inject(PaymentRepositoryImpl)
    protected readonly paymentRepository: PaymentRepository,
    @Inject(MetricsService)
    protected readonly metricsService: MetricsService,
  ) {}

  async onModuleInit() {
    await this.initializeQueues();
  }

  private async initializeQueues(): Promise<void> {
    const connection = {
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
    };

    this.statusCheckQueue = new Queue(QueueTYPE.PAYMENT_STATUS_CHECK, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 180000,
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

    this.paymentInitiationQueue = new Queue(QueueTYPE.PAYMENT_INITIATION, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });

    this.paymentInitiationWorker = new Worker(
      JobTYPE.PAYMENT_INITIATION,
      async (job: Job) => {
        return this.processPaymentInitiationJob(job);
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

    this.paymentInitiationWorker.on('completed', (job) => {
      this.logger.log(`Payment initiation job completed: ${job.id}`);
    });

    this.paymentInitiationWorker.on('failed', (job, error) => {
      this.logger.error(
        `Payment initiation job failed: ${job.id}`,
        error.stack,
      );
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

  async addPaymentInitiationJob(
    reference: string,
    options?: StatusCheckJobOptions,
  ): Promise<void> {
    const delay = options?.delay;

    await this.paymentInitiationQueue.add(
      JobTYPE.PAYMENT_INITIATION,
      { reference: reference },
      {
        delay,
        jobId: `payment-check-${reference}`,
      },
    );

    this.logger.log(
      `Added payment initiation job for transaction ${reference} with ${delay}ms delay`,
    );
  }

  private async processPaymentInitiationJob(job: Job): Promise<void> {
    const { reference, partnerId, channel } =
      job.data as PaymentInitiationJobData;

    this.logger.log(
      `Processing payment intiation for payment order: ${reference}`,
    );

    try {
      const paymentOrder = await this.paymentRepository.findByReference(
        reference,
      );
      if (!paymentOrder) {
        throw new TransactionNotFoundException(reference);
      }

      this.metricsService.incrementApiCall(partnerId, channel);
      const executor = this.executorFactory.getExecutor(partnerId, channel);

      let channelResponse: MpesaStkPushResponse | AirtelDirectDebitResponse;
      if (channel === PaymentChannel.MPESA) {
        const channelImpl =
          executor.getChannelImplementation() as IMpesaChannel;
        channelResponse = await channelImpl.stkPush({
          amount: paymentOrder.amount,
          phoneNumber: paymentOrder.phoneNumber,
          accountReference: paymentOrder.reference,
          partnerId: partnerId,
        });
      } else if (channel === PaymentChannel.AIRTEL) {
        const channelImpl =
          executor.getChannelImplementation() as IAirtelChannel;
        channelResponse = await channelImpl.directDebit({
          amount: paymentOrder.amount,
          phoneNumber: paymentOrder.phoneNumber,
          reference: paymentOrder.reference,
          partnerId: partnerId,
        });
      }

      await this.addStatusCheckJob(
        {
          transactionId: channelResponse.transactionId,
          partnerId: partnerId,
          channel: channel,
        },
        {
          delay: 10000,
        },
      );

      return;
    } catch (error) {
      this.logger.error(
        `Payment initiation failed for order ${reference}:`,
        error,
      );
      if (error.response) {
        const status = error.response.status;
        if (status >= 400 && status < 500) {
          this.metricsService.incrementApiError4xx(partnerId, channel, status);
        } else if (status >= 500) {
          this.metricsService.incrementApiError5xx(partnerId, channel, status);
        }
      } else if (error.code === 'ECONNREFUSED') {
        this.metricsService.incrementConnectionRefused(partnerId, channel);
      } else if (error.code === 'ETIMEDOUT') {
        this.metricsService.incrementApiTimeout(partnerId, channel);
      }
      throw error;
    }
  }
}
