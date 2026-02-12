import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('payments_initiated')
    public paymentsInitiated: Counter<string>,
    @InjectMetric('payments_success') public paymentsSuccess: Counter<string>,
    @InjectMetric('payments_success_rate')
    public paymentsSuccessRate: Gauge<string>,
    @InjectMetric('webhooks_received') public webhooksReceived: Counter<string>,
    @InjectMetric('webhooks_processed')
    public webhooksProcessed: Counter<string>,
    @InjectMetric('webhooks_failed') public webhooksFailed: Counter<string>,
    @InjectMetric('webhooks_delivery_rate')
    public webhooksDeliveryRate: Gauge<string>,
    @InjectMetric('payment_processing_duration')
    public paymentProcessingDuration: Histogram<string>,
    @InjectMetric('api_calls_total') public apiCallsTotal: Counter<string>,
    @InjectMetric('api_errors_4xx') public apiErrors4xx: Counter<string>,
    @InjectMetric('api_errors_5xx') public apiErrors5xx: Counter<string>,
    @InjectMetric('api_errors_connection_refused')
    public apiErrorsConnectionRefused: Counter<string>,
    @InjectMetric('api_errors_timeout')
    public apiErrorsTimeout: Counter<string>,
    @InjectMetric('api_error_rate') public apiErrorRate: Gauge<string>,
  ) {}

  incrementPaymentInitiated(partner: string, channel: string) {
    this.paymentsInitiated.inc({ partner, channel });
  }

  incrementPaymentSuccess(partner: string, channel: string) {
    this.paymentsSuccess.inc({ partner, channel });
  }

  setPaymentSuccessRate(partner: string, channel: string, rate: number) {
    this.paymentsSuccessRate.set({ partner, channel }, rate);
  }

  incrementWebhookReceived(partner: string) {
    this.webhooksReceived.inc({ partner, source: 'paymenthub' });
  }

  incrementWebhookProcessed(partner: string, status: string) {
    this.webhooksProcessed.inc({ partner, status });
  }

  incrementWebhookFailed(partner: string, reason: string) {
    this.webhooksFailed.inc({ partner, reason });
  }

  setWebhookDeliveryRate(rate: number) {
    this.webhooksDeliveryRate.set(rate);
  }

  recordPaymentDuration(
    partner: string,
    channel: string,
    status: string,
    durationSeconds: number,
  ) {
    this.paymentProcessingDuration.observe(
      { partner, channel, status },
      durationSeconds,
    );
  }

  incrementApiCall(partner: string, channel: string) {
    this.apiCallsTotal.inc({ partner, channel });
  }

  incrementApiError4xx(partner: string, channel: string, statusCode: number) {
    this.apiErrors4xx.inc({ partner, channel, status_code: statusCode });
  }

  incrementApiError5xx(partner: string, channel: string, statusCode: number) {
    this.apiErrors5xx.inc({ partner, channel, status_code: statusCode });
  }

  incrementConnectionRefused(partner: string, channel: string) {
    this.apiErrorsConnectionRefused.inc({ partner, channel });
  }

  incrementApiTimeout(partner: string, channel: string) {
    this.apiErrorsTimeout.inc({ partner, channel });
  }

  setApiErrorRate(partner: string, channel: string, rate: number) {
    this.apiErrorRate.set({ partner, channel }, rate);
  }
}
