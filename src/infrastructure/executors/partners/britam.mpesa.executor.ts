import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { BasePaymentExecutor } from '../base.payment.executor';
import { PaymentChannel } from 'src/shared/constants/payments';
import { BritamMpesaChannel } from 'src/infrastructure/channels/partners/britam.mpesa.channel';
import { RabbitMQService } from 'src/infrastructure/rabbitmq/rabbitmq.service';
import { PaymentRepository } from 'src/domain/repositories/payments.postgres.repository';
import { QueueService } from 'src/application/interfaces/queue.interface';
import { PaymentRepositoryImpl } from '../../repositories/payments.postgres.repository';
import { QueueServiceImpl } from '../../queue/queue.service.impl';

@Injectable()
export class BritamMpesaExecutor extends BasePaymentExecutor {
  constructor(
    @Inject(PaymentRepositoryImpl) paymentRepository: PaymentRepository,
    @Inject(forwardRef(() => QueueServiceImpl)) queueService: QueueService,
    rabbitmqService: RabbitMQService,
    private readonly britamMpesaChannel: BritamMpesaChannel,
  ) {
    super(paymentRepository, queueService, rabbitmqService);
  }

  getPartner(): string {
    return 'BRITAM';
  }

  getChannel(): PaymentChannel {
    return PaymentChannel.MPESA;
  }

  protected getChannelImplementation() {
    return this.britamMpesaChannel;
  }
}
