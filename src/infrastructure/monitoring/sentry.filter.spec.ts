import { Test, TestingModule } from '@nestjs/testing';
import { SentryFilter } from './sentry.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';

jest.mock('@sentry/nestjs');

describe('SentryFilter', () => {
  let filter: SentryFilter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SentryFilter],
    }).compile();

    filter = module.get<SentryFilter>(SentryFilter);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should capture exception and call super.catch', () => {
    const exception = new HttpException(
      'Test error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
    const mockGetRequest = jest.fn().mockReturnValue({});

    const host = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: mockGetRequest,
        getResponse: mockGetResponse,
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ArgumentsHost;

    const superCatchSpy = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => {
        //
      });

    filter.catch(exception, host);

    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
    expect(superCatchSpy).toHaveBeenCalledWith(exception, host);
  });
});
