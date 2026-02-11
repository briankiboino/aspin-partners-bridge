import { HttpStatus } from '@nestjs/common';

export class PaymentHubException extends Error {
  public errorCode: string;
  public statusCode: number;

  constructor(message = 'An error occured while processing your request') {
    super(message);
    this.name = 'PaymentHubException';
    this.errorCode = 'PAYMENT_HUB:UNKNOWN';
    this.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

export class UnsupportedPaymentChannelException extends PaymentHubException {
  constructor(channel: string) {
    super(`Unsupported payment channel: ${channel}`);
    this.name = 'UnsupportedPaymentChannelException';
    this.errorCode = 'PAYMENT_HUB:UNSUPPORTED_CHANNEL';
    this.statusCode = HttpStatus.BAD_REQUEST;
  }
}

export class TransactionNotFoundException extends PaymentHubException {
  constructor(transactionId: string) {
    super(`Transaction not found: ${transactionId}`);
    this.name = 'TransactionNotFoundException';
    this.errorCode = 'PAYMENT_HUB:TRANSACTION_NOT_FOUND';
    this.statusCode = HttpStatus.NOT_FOUND;
  }
}
