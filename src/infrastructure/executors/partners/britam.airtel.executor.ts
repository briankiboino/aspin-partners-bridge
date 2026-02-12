import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { BasePaymentExecutor } from '../base.payment.executor';
import { PaymentChannel } from 'src/shared/constants/payments';
import { BritamAirtelChannel } from 'src/infrastructure/channels/partners/britam.airtel.channel';
import { RabbitMQService } from 'src/infrastructure/rabbitmq/rabbitmq.service';
import { PaymentRepository } from 'src/domain/repositories/payments.postgres.repository';
import { QueueService } from 'src/application/interfaces/queue.interface';
import { PaymentRepositoryImpl } from '../../repositories/payments.postgres.repository';
import { QueueServiceImpl } from '../../queue/queue.service.impl';

@Injectable()
export class BritamAirtelExecutor extends BasePaymentExecutor {
  constructor(
    @Inject(PaymentRepositoryImpl) paymentRepository: PaymentRepository,
    @Inject(forwardRef(() => QueueServiceImpl)) queueService: QueueService,
    rabbitmqService: RabbitMQService,
    private readonly britamAirtelChannel: BritamAirtelChannel,
  ) {
    super(paymentRepository, queueService, rabbitmqService);
  }

  getPartner(): string {
    return 'BRITAM';
  }

  getChannel(): PaymentChannel {
    return PaymentChannel.AIRTEL;
  }

  protected getChannelImplementation() {
    return this.britamAirtelChannel;
  }
}
