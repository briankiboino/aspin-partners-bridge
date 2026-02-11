import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisProvider implements OnModuleInit {
  private readonly logger = new Logger(RedisProvider.name);
  private client: RedisClientType;

  getClient(): RedisClientType {
    return this.client;
  }

  async onModuleInit() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    this.client.on('connect', () => this.logger.log('Connected to Redis'));
    this.client.on('error', (err) => this.logger.error('Redis Error', err));

    await this.client.connect();
  }
}
