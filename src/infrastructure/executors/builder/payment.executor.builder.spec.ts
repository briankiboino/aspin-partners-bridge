import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../../repositories/payments.postgres.repository', () => ({
  PaymentRepositoryImpl: class MockPaymentRepositoryImpl {},
}));

jest.mock('../../queue/queue.service.impl', () => ({
  QueueServiceImpl: class MockQueueServiceImpl {},
}));

import { PaymentExecutorBuilder } from './payment.executor.builder';
import { BritamMpesaExecutor } from '../partners/britam.mpesa.executor';
import { ApaMpesaExecutor } from '../partners/apa.mpesa.executor';
import { BritamAirtelExecutor } from '../partners/britam.airtel.executor';
import { PaymentChannel } from 'src/shared/constants/payments';

describe('PaymentExecutorBuilder', () => {
  let builder: PaymentExecutorBuilder;
  let britamMpesaExecutor: any;
  let apaMpesaExecutor: any;
  let britamAirtelExecutor: any;

  beforeEach(async () => {
    britamMpesaExecutor = {
      getPartner: () => 'BRITAM',
      getChannel: () => PaymentChannel.MPESA,
    };
    apaMpesaExecutor = {
      getPartner: () => 'APA',
      getChannel: () => PaymentChannel.MPESA,
    };
    britamAirtelExecutor = {
      getPartner: () => 'BRITAM',
      getChannel: () => PaymentChannel.AIRTEL,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentExecutorBuilder,
        { provide: BritamMpesaExecutor, useValue: britamMpesaExecutor },
        { provide: ApaMpesaExecutor, useValue: apaMpesaExecutor },
        { provide: BritamAirtelExecutor, useValue: britamAirtelExecutor },
      ],
    }).compile();

    builder = module.get<PaymentExecutorBuilder>(PaymentExecutorBuilder);
  });

  it('should be defined', () => {
    expect(builder).toBeDefined();
  });

  describe('getExecutor', () => {
    it('should return correct executor for BRITAM MPESA', () => {
      const executor = builder.getExecutor('BRITAM', PaymentChannel.MPESA);
      expect(executor).toBe(britamMpesaExecutor);
    });

    it('should return correct executor for APA MPESA', () => {
      const executor = builder.getExecutor('APA', PaymentChannel.MPESA);
      expect(executor).toBe(apaMpesaExecutor);
    });

    it('should throw error if executor not found', () => {
      expect(() =>
        builder.getExecutor('UNKNOWN', PaymentChannel.MPESA),
      ).toThrow('No executor found');
    });
  });

  describe('hasExecutor', () => {
    it('should return true for existing executor', () => {
      expect(builder.hasExecutor('BRITAM', PaymentChannel.MPESA)).toBe(true);
    });

    it('should return false for non-existing executor', () => {
      expect(builder.hasExecutor('UNKNOWN', PaymentChannel.MPESA)).toBe(false);
    });
  });
});
