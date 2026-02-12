import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { getToken } from '@willsoto/nestjs-prometheus';

describe('MetricsService', () => {
  let service: MetricsService;

  const paymentsInitiatedMock = { inc: jest.fn() };
  const paymentsSuccessMock = { inc: jest.fn() };
  const paymentsSuccessRateMock = { set: jest.fn() };
  const webhooksReceivedMock = { inc: jest.fn() };
  const webhooksProcessedMock = { inc: jest.fn() };
  const webhooksFailedMock = { inc: jest.fn() };
  const webhooksDeliveryRateMock = { set: jest.fn() };
  const paymentProcessingDurationMock = { observe: jest.fn() };
  const apiCallsTotalMock = { inc: jest.fn() };
  const apiErrors4xxMock = { inc: jest.fn() };
  const apiErrors5xxMock = { inc: jest.fn() };
  const apiErrorsConnectionRefusedMock = { inc: jest.fn() };
  const apiErrorsTimeoutMock = { inc: jest.fn() };
  const apiErrorRateMock = { set: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: getToken('payments_initiated'),
          useValue: paymentsInitiatedMock,
        },
        {
          provide: getToken('payments_success'),
          useValue: paymentsSuccessMock,
        },
        {
          provide: getToken('payments_success_rate'),
          useValue: paymentsSuccessRateMock,
        },
        {
          provide: getToken('webhooks_received'),
          useValue: webhooksReceivedMock,
        },
        {
          provide: getToken('webhooks_processed'),
          useValue: webhooksProcessedMock,
        },
        { provide: getToken('webhooks_failed'), useValue: webhooksFailedMock },
        {
          provide: getToken('webhooks_delivery_rate'),
          useValue: webhooksDeliveryRateMock,
        },
        {
          provide: getToken('payment_processing_duration'),
          useValue: paymentProcessingDurationMock,
        },
        { provide: getToken('api_calls_total'), useValue: apiCallsTotalMock },
        { provide: getToken('api_errors_4xx'), useValue: apiErrors4xxMock },
        { provide: getToken('api_errors_5xx'), useValue: apiErrors5xxMock },
        {
          provide: getToken('api_errors_connection_refused'),
          useValue: apiErrorsConnectionRefusedMock,
        },
        {
          provide: getToken('api_errors_timeout'),
          useValue: apiErrorsTimeoutMock,
        },
        { provide: getToken('api_error_rate'), useValue: apiErrorRateMock },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Payment Metrics', () => {
    it('should increment payments_initiated', () => {
      service.incrementPaymentInitiated('partner1', 'channel1');
      expect(paymentsInitiatedMock.inc).toHaveBeenCalledWith({
        partner: 'partner1',
        channel: 'channel1',
      });
    });

    it('should increment payments_success', () => {
      service.incrementPaymentSuccess('partner1', 'channel1');
      expect(paymentsSuccessMock.inc).toHaveBeenCalledWith({
        partner: 'partner1',
        channel: 'channel1',
      });
    });

    it('should set payments_success_rate', () => {
      service.setPaymentSuccessRate('partner1', 'channel1', 99.5);
      expect(paymentsSuccessRateMock.set).toHaveBeenCalledWith(
        { partner: 'partner1', channel: 'channel1' },
        99.5,
      );
    });

    it('should record payment duration', () => {
      service.recordPaymentDuration('partner1', 'channel1', 'success', 1.5);
      expect(paymentProcessingDurationMock.observe).toHaveBeenCalledWith(
        { partner: 'partner1', channel: 'channel1', status: 'success' },
        1.5,
      );
    });
  });

  describe('Webhook Metrics', () => {
    it('should increment webhooks_received', () => {
      service.incrementWebhookReceived('partner1');
      expect(webhooksReceivedMock.inc).toHaveBeenCalledWith({
        partner: 'partner1',
        source: 'paymenthub',
      });
    });

    it('should increment webhooks_processed', () => {
      service.incrementWebhookProcessed('partner1', 'success');
      expect(webhooksProcessedMock.inc).toHaveBeenCalledWith({
        partner: 'partner1',
        status: 'success',
      });
    });

    it('should increment webhooks_failed', () => {
      service.incrementWebhookFailed('partner1', 'timeout');
      expect(webhooksFailedMock.inc).toHaveBeenCalledWith({
        partner: 'partner1',
        reason: 'timeout',
      });
    });

    it('should set webhooks_delivery_rate', () => {
      service.setWebhookDeliveryRate(98.2);
      expect(webhooksDeliveryRateMock.set).toHaveBeenCalledWith(98.2);
    });
  });

  describe('API Metrics', () => {
    it('should increment api_calls_total', () => {
      service.incrementApiCall('partner1', 'channel1');
      expect(apiCallsTotalMock.inc).toHaveBeenCalledWith({
        partner: 'partner1',
        channel: 'channel1',
      });
    });

    it('should increment api_errors_4xx', () => {
      service.incrementApiError4xx('partner1', 'channel1', 400);
      expect(apiErrors4xxMock.inc).toHaveBeenCalledWith({
        partner: 'partner1',
        channel: 'channel1',
        status_code: 400,
      });
    });

    it('should increment api_errors_5xx', () => {
      service.incrementApiError5xx('partner1', 'channel1', 500);
      expect(apiErrors5xxMock.inc).toHaveBeenCalledWith({
        partner: 'partner1',
        channel: 'channel1',
        status_code: 500,
      });
    });

    it('should increment api_errors_connection_refused', () => {
      service.incrementConnectionRefused('partner1', 'channel1');
      expect(apiErrorsConnectionRefusedMock.inc).toHaveBeenCalledWith({
        partner: 'partner1',
        channel: 'channel1',
      });
    });

    it('should increment api_errors_timeout', () => {
      service.incrementApiTimeout('partner1', 'channel1');
      expect(apiErrorsTimeoutMock.inc).toHaveBeenCalledWith({
        partner: 'partner1',
        channel: 'channel1',
      });
    });

    it('should set api_error_rate', () => {
      service.setApiErrorRate('partner1', 'channel1', 0.05);
      expect(apiErrorRateMock.set).toHaveBeenCalledWith(
        { partner: 'partner1', channel: 'channel1' },
        0.05,
      );
    });
  });
});
