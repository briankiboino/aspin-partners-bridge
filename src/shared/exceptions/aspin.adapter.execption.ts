import { HttpStatus } from '@nestjs/common';

export class AspinAdapterException extends Error {
  public errorCode: string;
  public statusCode: number;

  constructor(message = 'An error occured while processing your request') {
    super(message);
    this.name = 'AspinAdapterException';
    this.errorCode = 'ASPIN_SERVICE:UNKNOWN';
    this.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
