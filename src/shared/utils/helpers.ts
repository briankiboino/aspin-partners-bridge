import { PaymentChannel } from '../constants/payments';

export const buildResponse = async (
  res: any,
  statusCode: number,
  success: boolean,
  message: string,
  error: any,
  data: any,
) => {
  return res?.status(statusCode).json({
    success: success,
    message: message,
    error: error,
    data: data,
  });
};

export const determineChannelFromPayload = (payload: any): PaymentChannel => {
  if (payload.MerchantRequestID || payload.CheckoutRequestID) {
    return PaymentChannel.MPESA;
  }

  if (payload.data?.transaction?.id || payload.transaction?.airtel_money_id) {
    return PaymentChannel.AIRTEL;
  }

  return PaymentChannel.MPESA;
};
