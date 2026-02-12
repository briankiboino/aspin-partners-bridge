import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisProvider implements OnModuleInit {
  private readonly logger = new Logger(RedisProvider.name);
  private client: RedisClientType;

  constructor(private readonly configService: ConfigService) {}

  getRedisOptions() {
    return {
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
    };
  }

  getClient(): RedisClientType {
    return this.client;
  }

  async onModuleInit() {
    const { host, port } = this.getRedisOptions();
    const url =
      this.configService.get<string>('REDIS_URL') || `redis://${host}:${port}`;

    this.client = createClient({
      url,
    });

    this.client.on('connect', () => this.logger.log('Connected to Redis'));
    this.client.on('error', (err) => this.logger.error('Redis Error', err));

    await this.client.connect();
  }
}
