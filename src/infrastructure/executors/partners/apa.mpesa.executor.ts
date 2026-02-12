import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { BasePaymentExecutor } from '../base.payment.executor';
import { PaymentChannel } from 'src/shared/constants/payments';
import { ApaMpesaChannel } from 'src/infrastructure/channels/partners/apa.mpesa.channel';
import { RabbitMQService } from 'src/infrastructure/rabbitmq/rabbitmq.service';
import { PaymentRepository } from 'src/domain/repositories/payments.postgres.repository';
import { QueueService } from 'src/application/interfaces/queue.interface';
import { PaymentRepositoryImpl } from '../../repositories/payments.postgres.repository';
import { QueueServiceImpl } from '../../queue/queue.service.impl';
import { AspinAdapter } from 'src/application/interfaces/aspin.adapter.interface';
import { MetricsService } from '../../monitoring/metrics.service';

@Injectable()
export class ApaMpesaExecutor extends BasePaymentExecutor {
  constructor(
    @Inject(PaymentRepositoryImpl) paymentRepository: PaymentRepository,
    @Inject(forwardRef(() => QueueServiceImpl)) queueService: QueueService,
    rabbitmqService: RabbitMQService,
    @Inject('AspinAdapter') aspinAdapter: AspinAdapter,
    metricsService: MetricsService,
    private readonly apaMpesaChannel: ApaMpesaChannel,
  ) {
    super(
      paymentRepository,
      queueService,
      rabbitmqService,
      aspinAdapter,
      metricsService,
    );
  }

  getPartner(): string {
    return 'APA';
  }

  getChannel(): PaymentChannel {
    return PaymentChannel.MPESA;
  }

  protected getChannelImplementation() {
    return this.apaMpesaChannel;
  }
}
