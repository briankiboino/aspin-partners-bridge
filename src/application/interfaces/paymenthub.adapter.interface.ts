import {
  PaymentHubAirtelRequest,
  PaymentHubInitiateResponse,
  PaymentHubMpesaRequest,
  PaymentHubStatusResponse,
} from 'src/infrastructure/adapters/paymenthub.adapter';

export interface PaymentHubAdapter {
  initiateMpesaPayment(
    payload: PaymentHubMpesaRequest,
  ): Promise<PaymentHubInitiateResponse>;
  initiateAirtelPayment(
    payload: PaymentHubAirtelRequest,
  ): Promise<PaymentHubInitiateResponse>;
  queryMpesaStatus(transactionId: string): Promise<PaymentHubStatusResponse>;
  queryAirtelStatus(transactionId: string): Promise<PaymentHubStatusResponse>;
}
