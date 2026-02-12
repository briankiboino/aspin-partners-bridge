import {
  PaymentHubAirtelRequest,
  PaymentHubAirtelResponse,
  PaymentHubMpesaRequest,
  PaymentHubMpesaResponse,
  PaymentHubStatusResponse,
} from 'src/infrastructure/adapters/paymenthub.adapter';

export interface PaymentHubAdapter {
  initiateMpesaPayment(
    payload: PaymentHubMpesaRequest,
  ): Promise<PaymentHubMpesaResponse>;
  initiateAirtelPayment(
    payload: PaymentHubAirtelRequest,
  ): Promise<PaymentHubAirtelResponse>;
  queryMpesaStatus(transactionId: string): Promise<PaymentHubStatusResponse>;
  queryAirtelStatus(transactionId: string): Promise<PaymentHubStatusResponse>;
}
