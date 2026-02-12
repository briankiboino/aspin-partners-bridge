export interface MpesaStkPushPayload {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  partnerId: string;
}

export interface MpesaStkPushResponse {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface MpesaQueryResponse {
  responseCode: string;
  responseDescription: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: string;
  resultDesc: string;
}

export interface AirtelDirectDebitPayload {
  phoneNumber: string;
  amount: number;
  reference: string;
  partnerId: string;
}

export interface AirtelDirectDebitResponse {
  transactionId: string;
  status: string;
  message: string;
  amount?: number;
  currency?: string;
}

export interface AirtelQueryResponse {
  transactionId: string;
  status: string;
  amount?: number;
  currency?: string;
}
