import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsUseCase } from '../../application/interfaces/payments.usecases.interface';
import { Response } from 'express';
import { HttpStatus } from '@nestjs/common';
import { PaymentChannel } from 'src/shared/constants/payments';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let useCase: PaymentsUseCase;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const mockUseCase = {
      initiatePayment: jest.fn(),
      handleWebhook: jest.fn(),
      checkPayment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: 'PaymentsUseCase',
          useValue: mockUseCase,
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    useCase = module.get<PaymentsUseCase>('PaymentsUseCase');
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('initiatePayment', () => {
    const dto = {
      amount: 100,
      currency: 'KES',
      customer_id: 'cust_123',
      reference: 'ref_123',
      channel: PaymentChannel.MPESA,
      partner_id: 'partner_123',
      phoneNumber: '254700000000',
    };

    it('should successfully initiate payment', async () => {
      const mockResult = {
        transaction_id: 'txn_123',
        status: 'pending',
        amount: 100,
        currency: 'KES',
        timestamp: new Date(),
      };
      (useCase.initiatePayment as jest.Mock).mockResolvedValue(mockResult);

      await controller.initiatePayment(mockResponse as Response, dto);

      expect(useCase.initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: dto.amount,
          currency: dto.currency,
          customer_id: dto.customer_id,
          reference: dto.reference,
          channel: dto.channel,
          partner_id: dto.partner_id,
        }),
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            transaction_id: 'txn_123',
          }),
        }),
      );
    });

    it('should handle errors', async () => {
      const error = new Error('Initiation failed');
      (useCase.initiatePayment as jest.Mock).mockRejectedValue(error);

      await controller.initiatePayment(mockResponse as Response, dto);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Initiation failed',
        }),
      );
    });
  });

  describe('handleWebhook', () => {
    const dto = {
      transaction_id: 'txn_123',
      status: 'completed',
      amount: 100,
      currency: 'KES',
      timestamp: new Date().toISOString(),
      signature: 'sig_123',
    };
    const partnerId = 'partner_123';

    it('should successfully process webhook', async () => {
      const mockResult = {
        transaction_id: 'txn_123',
        status: 'completed',
        processed: true,
      };
      (useCase.handleWebhook as jest.Mock).mockResolvedValue(mockResult);

      await controller.handleWebhook(
        mockResponse as Response,
        dto as any,
        partnerId,
      );

      expect(useCase.handleWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_id: dto.transaction_id,
          status: dto.status,
          partner_id: partnerId,
        }),
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Payment notification processed successfully',
        }),
      );
    });
  });

  describe('checkPayment', () => {
    const transactionId = 'txn_123';

    it('should return payment status when found', async () => {
      const mockResult = {
        transaction_id: transactionId,
        status: 'completed',
      };
      (useCase.checkPayment as jest.Mock).mockResolvedValue(mockResult);

      await controller.checkPayment(mockResponse as Response, transactionId);

      expect(useCase.checkPayment).toHaveBeenCalledWith(transactionId);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            transaction_id: transactionId,
          }),
        }),
      );
    });

    it('should return 404 when payment not found', async () => {
      (useCase.checkPayment as jest.Mock).mockResolvedValue(null);

      await controller.checkPayment(mockResponse as Response, transactionId);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Payment not found',
        }),
      );
    });
  });
});
