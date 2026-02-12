import { Test, TestingModule } from '@nestjs/testing';
import { ValidationFilter } from './validation.filter';
import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ValidationError } from 'class-validator';
import * as helpers from '../../shared/utils/helpers';
import { PayloadValidationException } from '../../shared/exceptions/payload.validation.exception';

describe('ValidationFilter', () => {
  let filter: ValidationFilter;
  let mockBuildResponse: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationFilter],
    }).compile();

    filter = module.get<ValidationFilter>(ValidationFilter);
    mockBuildResponse = jest
      .spyOn(helpers, 'buildResponse')
      .mockImplementation(() => null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should catch generic BadRequestException and call buildResponse', () => {
    const mockResponse = {} as unknown as Response;

    const mockHttpArgumentsHost = {
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn(),
      getNext: jest.fn(),
    };

    const mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpArgumentsHost),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ArgumentsHost;

    const exception = new BadRequestException('Bad Request Error');

    filter.catch(exception, mockArgumentsHost);

    expect(mockArgumentsHost.switchToHttp).toHaveBeenCalled();
    expect(mockHttpArgumentsHost.getResponse).toHaveBeenCalled();
    expect(mockBuildResponse).toHaveBeenCalledWith(
      mockResponse,
      HttpStatus.BAD_REQUEST,
      false,
      'Bad Request Error',
      expect.any(PayloadValidationException),
      null,
    );
  });

  it('should handle validation errors (array of ValidationError)', () => {
    const mockResponse = {} as unknown as Response;

    const mockHttpArgumentsHost = {
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn(),
      getNext: jest.fn(),
    };

    const mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpArgumentsHost),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ArgumentsHost;

    const validationError = new ValidationError();
    validationError.property = 'email';
    validationError.constraints = { isEmail: 'email must be an email' };

    const exceptionResponse = {
      message: [validationError],
      statusCode: 400,
      error: 'Bad Request',
    };

    const exception = new BadRequestException(exceptionResponse);
    jest.spyOn(exception, 'getResponse').mockReturnValue(exceptionResponse);

    filter.catch(exception, mockArgumentsHost);

    expect(mockBuildResponse).toHaveBeenCalledWith(
      mockResponse,
      HttpStatus.BAD_REQUEST,
      false,
      'Validation failed: email must be an email',
      expect.any(PayloadValidationException),
      null,
    );
  });

  it('should handle nested validation errors or multiple constraints', () => {
    const mockResponse = {} as unknown as Response;

    const mockHttpArgumentsHost = {
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn(),
      getNext: jest.fn(),
    };

    const mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpArgumentsHost),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ArgumentsHost;

    const validationError1 = new ValidationError();
    validationError1.property = 'email';
    validationError1.constraints = { isEmail: 'email must be an email' };

    const validationError2 = new ValidationError();
    validationError2.property = 'password';
    validationError2.constraints = {
      minLength: 'password too short',
      maxLength: 'password too long',
    };

    const exceptionResponse = {
      message: [validationError1, validationError2],
      statusCode: 400,
      error: 'Bad Request',
    };

    const exception = new BadRequestException(exceptionResponse);
    jest.spyOn(exception, 'getResponse').mockReturnValue(exceptionResponse);

    filter.catch(exception, mockArgumentsHost);

    expect(mockBuildResponse).toHaveBeenCalledWith(
      mockResponse,
      HttpStatus.BAD_REQUEST,
      false,
      'Validation failed: email must be an email, password too short, password too long',
      expect.any(PayloadValidationException),
      null,
    );
  });

  it('should handle non-validation error array messages', () => {
    const mockResponse = {} as unknown as Response;

    const mockHttpArgumentsHost = {
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn(),
      getNext: jest.fn(),
    };

    const mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpArgumentsHost),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ArgumentsHost;

    const exceptionResponse = {
      message: ['Some error message', 'Another error'],
      statusCode: 400,
      error: 'Bad Request',
    };

    const exception = new BadRequestException(exceptionResponse);
    jest.spyOn(exception, 'getResponse').mockReturnValue(exceptionResponse);

    filter.catch(exception, mockArgumentsHost);

    expect(mockBuildResponse).toHaveBeenCalledWith(
      mockResponse,
      HttpStatus.BAD_REQUEST,
      false,
      ['Some error message', 'Another error'],
      expect.any(PayloadValidationException),
      null,
    );
  });
});
