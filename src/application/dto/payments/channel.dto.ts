export interface MpesaStkPushPayload {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc?: string;
  partnerId: string;
}

export interface MpesaStkPushResponse {
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
  timestamp: string;
}

export interface MpesaQueryResponse {
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
  timestamp: string;
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
  amount: number;
  currency: string;
  timestamp: string;
  message?: string;
}

export interface AirtelQueryResponse {
  transactionId: string;
  status: string;
  amount?: number;
  currency?: string;
  timestamp: string;
}
