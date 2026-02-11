import { HttpStatus } from '@nestjs/common';

export class PayloadValidationException extends Error {
  public errorCode: string;
  public statusCode: number;

  constructor(message = 'Payload validation failed') {
    super(message);
    this.name = 'PayloadValidationException';
    this.errorCode = 'PAYLOAD:VALIDATION:INVALID_PAYLOAD';
    this.statusCode = HttpStatus.BAD_REQUEST;
  }
}
