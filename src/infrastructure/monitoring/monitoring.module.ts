import { Module, Global } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  providers: [
    MetricsService,
    makeCounterProvider({
      name: 'payments_initiated',
      help: 'Total number of payments initiated',
      labelNames: ['partner', 'channel'],
    }),
    makeCounterProvider({
      name: 'payments_success',
      help: 'Total number of successful payments',
      labelNames: ['partner', 'channel'],
    }),
    makeGaugeProvider({
      name: 'payments_success_rate',
      help: 'Current payment success rate',
      labelNames: ['partner', 'channel'],
    }),
    makeCounterProvider({
      name: 'webhooks_received',
      help: 'Total webhooks received',
      labelNames: ['partner', 'source'],
    }),
    makeCounterProvider({
      name: 'webhooks_processed',
      help: 'Total webhooks processed',
      labelNames: ['partner', 'status'],
    }),
    makeCounterProvider({
      name: 'webhooks_failed',
      help: 'Total webhooks failed',
      labelNames: ['partner', 'reason'],
    }),
    makeGaugeProvider({
      name: 'webhooks_delivery_rate',
      help: 'Webhook delivery rate',
    }),
    makeHistogramProvider({
      name: 'payment_processing_duration',
      help: 'Time to process payment from initiation to completion',
      buckets: [1, 5, 10, 30, 60, 120, 300],
      labelNames: ['partner', 'channel', 'status'],
    }),
    makeCounterProvider({
      name: 'api_calls_total',
      help: 'Total API calls',
      labelNames: ['partner', 'channel'],
    }),
    makeCounterProvider({
      name: 'api_errors_4xx',
      help: 'API 4xx errors',
      labelNames: ['partner', 'channel', 'status_code'],
    }),
    makeCounterProvider({
      name: 'api_errors_5xx',
      help: 'API 5xx errors',
      labelNames: ['partner', 'channel', 'status_code'],
    }),
    makeCounterProvider({
      name: 'api_errors_connection_refused',
      help: 'API connection refused errors',
      labelNames: ['partner', 'channel'],
    }),
    makeCounterProvider({
      name: 'api_errors_timeout',
      help: 'API timeout errors',
      labelNames: ['partner', 'channel'],
    }),
    makeGaugeProvider({
      name: 'api_error_rate',
      help: 'API error rate',
      labelNames: ['partner', 'channel'],
    }),
  ],
  exports: [MetricsService],
})
export class MonitoringModule {}
