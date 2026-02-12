import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private readonly EXCHANGE_NAME = 'payment.events';
  private readonly EXCHANGE_TYPE = 'topic';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  private async connect(): Promise<void> {
    try {
      const rabbitMQUrl =
        this.configService.get<string>('RABBITMQ_URL') ||
        'amqp://localhost:5672';

      this.connection = await amqp.connect(rabbitMQUrl);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(
        this.EXCHANGE_NAME,
        this.EXCHANGE_TYPE,
        {
          durable: true,
        },
      );

      this.logger.log('Connected to RabbitMQ');

      this.connection.on('error', (error) => {
        this.logger.error('RabbitMQ connection error:', error);
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        setTimeout(() => this.connect(), 5000);
      });
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async publish(
    exchange: string,
    routingKey: string,
    message: any,
  ): Promise<boolean> {
    try {
      if (!this.channel) {
        this.logger.error('RabbitMQ channel not available');
        return false;
      }

      const messageBuffer = Buffer.from(JSON.stringify(message));

      const published = this.channel.publish(
        exchange,
        routingKey,
        messageBuffer,
        {
          persistent: true,
          timestamp: Date.now(),
          contentType: 'application/json',
        },
      );

      if (published) {
        this.logger.log(
          `Published message to exchange: ${exchange}, routing key: ${routingKey}`,
        );
      } else {
        this.logger.warn('Failed to publish message - channel buffer full');
      }

      return published;
    } catch (error) {
      this.logger.error('Error publishing message to RabbitMQ:', error);
      return false;
    }
  }

  async publishPaymentCompleted(event: PaymentEvent): Promise<boolean> {
    return this.publish(
      this.EXCHANGE_NAME,
      `payment.completed.${event.partner_id}`,
      event,
    );
  }

  async publishPaymentFailed(event: PaymentEvent): Promise<boolean> {
    return this.publish(
      this.EXCHANGE_NAME,
      `payment.failed.${event.partner_id}`,
      event,
    );
  }

  async publishPaymentPending(event: PaymentEvent): Promise<boolean> {
    return this.publish(
      this.EXCHANGE_NAME,
      `payment.pending.${event.partner_id}`,
      event,
    );
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.logger.log('RabbitMQ connection closed');
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connection:', error);
    }
  }
}

export interface PaymentEvent {
  transaction_id: string;
  partner_id: string;
  channel: string;
  amount: number;
  currency: string;
  status: string;
  timestamp: string;
  customer_id: string;
  reference: string;
}
