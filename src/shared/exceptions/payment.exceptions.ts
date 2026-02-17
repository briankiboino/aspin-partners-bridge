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
    this.errorCode = 'PAYMENT_HUB:PAYMENT_CHANNEL:UNSUPPORTED_CHANNEL';
    this.statusCode = HttpStatus.BAD_REQUEST;
  }
}

export class TransactionNotFoundException extends PaymentHubException {
  constructor(transactionId: string) {
    super(`Transaction not found: ${transactionId}`);
    this.name = 'TransactionNotFoundException';
    this.errorCode = 'PAYMENT_HUB:TRANSACTION:RECORD_NOT_FOUND';
    this.statusCode = HttpStatus.NOT_FOUND;
  }
}

export class PartnerExecutorNotFoundException extends PaymentHubException {
  constructor(message: string) {
    super(message);
    this.name = 'PartnerExecutorNotFoundException';
    this.errorCode = 'PAYMENT_HUB:PARTNER_EXECUTOR:RECORD_NOT_FOUND';
    this.statusCode = HttpStatus.NOT_FOUND;
  }
}

export class PartnerConfigurationNotFoundException extends PaymentHubException {
  constructor(message: string) {
    super(`Partner configuration not found: ${message}`);
    this.name = 'PartnerConfigurationNotFoundException';
    this.errorCode = 'PAYMENT_HUB:PARTNER_CONFIG:RECORD_NOT_FOUND';
    this.statusCode = HttpStatus.NOT_FOUND;
  }
}

export class DuplicateTransactionAttemptException extends PaymentHubException {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateTransactionAttemptException';
    this.errorCode = 'PAYMENT_HUB:TRANSACTION:DUPLICATE_ATTEMPT';
    this.statusCode = HttpStatus.CONFLICT;
  }
}

export class InvalidCallbackSignatureException extends PaymentHubException {
  constructor() {
    super('Invalid callback signature');
    this.name = 'InvalidCallbackSignatureException';
    this.errorCode = 'PAYMENT_HUB:TRANSACTION:INVALID_SIGNATURE';
    this.statusCode = HttpStatus.UNAUTHORIZED;
  }
}

export class UnknownPaymentStatusException extends PaymentHubException {
  constructor() {
    super('Unknown status response format');
    this.name = 'UnknownPaymentStatusException';
    this.errorCode = 'PAYMENT_HUB:TRANSACTION:UNKNOWN_STATUS';
    this.statusCode = HttpStatus.BAD_REQUEST;
  }
}
