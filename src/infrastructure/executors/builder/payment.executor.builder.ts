import { Injectable, Logger } from '@nestjs/common';
import { IPaymentExecutor } from 'src/application/interfaces/payment.executor.interface';
import { PaymentChannel } from 'src/shared/constants/payments';
import { BritamMpesaExecutor } from '../partners/britam.mpesa.executor';
import { ApaMpesaExecutor } from '../partners/apa.mpesa.executor';
import { BritamAirtelExecutor } from '../partners/britam.airtel.executor';
import { PartnerExecutorNotFoundException } from 'src/shared/exceptions/payment.exceptions';

@Injectable()
export class PaymentExecutorBuilder {
  private readonly logger = new Logger(PaymentExecutorBuilder.name);
  private readonly executors: Map<string, IPaymentExecutor> = new Map();

  constructor(
    private readonly britamMpesaExecutor: BritamMpesaExecutor,
    private readonly apaMpesaExecutor: ApaMpesaExecutor,
    private readonly britamAirtelExecutor: BritamAirtelExecutor,
  ) {
    this.registerExecutors();
  }

  private registerExecutors(): void {
    this.register(this.britamMpesaExecutor);
    this.register(this.apaMpesaExecutor);
    this.register(this.britamAirtelExecutor);
  }

  private register(executor: IPaymentExecutor): void {
    const key = this.getExecutorKey(
      executor.getPartner(),
      executor.getChannel(),
    );
    this.executors.set(key, executor);
    this.logger.log(`Registered executor: ${key}`);
  }

  getExecutor(partnerId: string, channel: PaymentChannel): IPaymentExecutor {
    const key = this.getExecutorKey(partnerId, channel);
    const executor = this.executors.get(key);

    if (!executor) {
      throw new PartnerExecutorNotFoundException(
        `No executor found for partner ${partnerId} and channel ${channel}`,
      );
    }

    return executor;
  }

  getAllExecutors(): IPaymentExecutor[] {
    return Array.from(this.executors.values());
  }

  hasExecutor(partnerId: string, channel: PaymentChannel): boolean {
    const key = this.getExecutorKey(partnerId, channel);
    return this.executors.has(key);
  }

  private getExecutorKey(partnerId: string, channel: PaymentChannel): string {
    return `${partnerId.toUpperCase()}_${channel}`;
  }
}
