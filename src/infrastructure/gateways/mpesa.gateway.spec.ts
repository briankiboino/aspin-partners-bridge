import { MPesaGateway } from './mpesa.gateway';
import { PartnerConfigurationsRepository } from '../../domain/repositories/partner.configurations.repository';
import { PaymentHubAdapter } from '../../application/interfaces/paymenthub.adapter.interface';
import { PaymentChannel } from '../../shared/constants/payments';
import { InitiatePaymentPayload } from '../../application/dto/payments/input';

describe('MPesaGateway', () => {
  let gateway: MPesaGateway;
  let configRepo: PartnerConfigurationsRepository;
  let paymentHub: PaymentHubAdapter;

  const mockConfigRepo = {
    getConfig: jest.fn(),
    getDefaultConfig: jest.fn(),
  } as unknown as PartnerConfigurationsRepository;

  const mockPaymentHub = {
    initiatePayment: jest.fn(),
    handleWebhook: jest.fn(),
    checkPayment: jest.fn(),
  } as unknown as PaymentHubAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new MPesaGateway(mockConfigRepo, mockPaymentHub);
    configRepo = mockConfigRepo;
    paymentHub = mockPaymentHub;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('initiatePayment', () => {
    it('should load config and call paymentHub.initiatePayment with enriched payload', async () => {
      const partnerId = 'partner1';
      const payload: InitiatePaymentPayload = {
        partner_id: partnerId,
        amount: 100,
        currency: 'KES',
        channel: PaymentChannel.MPESA,
        customer_id: 'cust1',
        reference: 'ref1',
      };

      const config = { apiKey: 'key1' };
      (mockConfigRepo.getConfig as jest.Mock).mockResolvedValue({ config });
      (mockPaymentHub.initiatePayment as jest.Mock).mockResolvedValue({
        success: true,
      });

      await gateway.initiatePayment(payload);

      expect(mockConfigRepo.getConfig).toHaveBeenCalledWith(
        partnerId,
        PaymentChannel.MPESA,
      );
      expect(mockPaymentHub.initiatePayment).toHaveBeenCalledWith({
        ...payload,
        config: config,
      });
    });

    it('should throw error if no config found', async () => {
      const partnerId = 'partner1';
      const payload: InitiatePaymentPayload = {
        partner_id: partnerId,
        amount: 100,
        currency: 'KES',
        channel: PaymentChannel.MPESA,
        customer_id: 'cust1',
        reference: 'ref1',
      };

      (mockConfigRepo.getConfig as jest.Mock).mockResolvedValue(null);
      (mockConfigRepo.getDefaultConfig as jest.Mock).mockResolvedValue(null);

      await expect(gateway.initiatePayment(payload)).rejects.toThrow(
        `No configuration found for partner ${partnerId} on channel ${PaymentChannel.MPESA}`,
      );
    });
  });

  describe('checkStatus', () => {
    it('should call paymentHub.checkPayment', async () => {
      const transactionId = 'tx1';
      const partnerId = 'partner1';
      (mockPaymentHub.checkPayment as jest.Mock).mockResolvedValue({
        status: 'SUCCESS',
      });

      await gateway.checkStatus(transactionId, partnerId);

      expect(mockPaymentHub.checkPayment).toHaveBeenCalledWith(transactionId);
    });
  });
});
