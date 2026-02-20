import { RedisProvider } from './redis.provider';
import { createClient } from 'redis';

jest.mock('redis', () => {
  const connect = jest.fn();
  const on = jest.fn();

  return {
    createClient: jest.fn(() => ({
      connect,
      on,
    })),
  };
});

describe('RedisProvider', () => {
  let configService: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn(),
    };
  });

  it('should return redis options from config with defaults', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'REDIS_HOST') {
        return 'custom-host';
      }
      if (key === 'REDIS_PORT') {
        return 1234;
      }
      return undefined;
    });

    const provider = new RedisProvider(configService as any);
    const options = provider.getRedisOptions();

    expect(options).toEqual({
      host: 'custom-host',
      port: 1234,
    });
  });

  it('should use default host and port when not configured', () => {
    configService.get.mockReturnValue(undefined);

    const provider = new RedisProvider(configService as any);
    const options = provider.getRedisOptions();

    expect(options).toEqual({
      host: 'localhost',
      port: 6379,
    });
  });

  it('should create redis client with REDIS_URL when provided', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'REDIS_URL') {
        return 'redis://custom-url:9999';
      }
      if (key === 'REDIS_HOST') {
        return 'ignored-host';
      }
      if (key === 'REDIS_PORT') {
        return 1111;
      }
      return undefined;
    });

    const provider = new RedisProvider(configService as any);
    await provider.onModuleInit();

    expect(createClient).toHaveBeenCalledWith({
      url: 'redis://custom-url:9999',
    });

    const clientInstance = (createClient as jest.Mock).mock.results[0].value;
    expect(clientInstance.connect).toHaveBeenCalled();
  });

  it('should create redis client with host and port when REDIS_URL is not set', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'REDIS_HOST') {
        return 'host-from-config';
      }
      if (key === 'REDIS_PORT') {
        return 6380;
      }
      return undefined;
    });

    const provider = new RedisProvider(configService as any);
    await provider.onModuleInit();

    expect(createClient).toHaveBeenCalledWith({
      url: 'redis://host-from-config:6380',
    });

    const clientInstance = (createClient as jest.Mock).mock.results[0].value;
    expect(clientInstance.connect).toHaveBeenCalled();
  });
});
