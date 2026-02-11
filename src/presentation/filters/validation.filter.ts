import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ValidationError } from 'class-validator';
import { PayloadValidationException } from 'src/shared/exceptions/payload.validation.exception';
import { buildResponse } from 'src/shared/utils/helpers';

@Catch(BadRequestException)
export class ValidationFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const exceptionResponse = exception.getResponse();

    if (
      Array.isArray((exceptionResponse as any).message) &&
      (exceptionResponse as any).message[0] instanceof ValidationError
    ) {
      const validationErrors = (exceptionResponse as any)
        .message as ValidationError[];
      const messages = validationErrors
        .map((error) => Object.values(error.constraints))
        .flat();

      return buildResponse(
        response,
        HttpStatus.BAD_REQUEST,
        false,
        `Validation failed: ${messages.join(', ')}`,
        new PayloadValidationException(exception?.message as any),
        null,
      );
    }

    return buildResponse(
      response,
      HttpStatus.BAD_REQUEST,
      false,
      (exceptionResponse as any).message || 'Bad Request',
      new PayloadValidationException(exception?.message as any),
      null,
    );
  }
}
