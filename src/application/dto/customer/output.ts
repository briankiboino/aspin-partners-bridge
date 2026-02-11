export interface UpsertCustomerResponse {
  customer_id: string;
  status: string;
  message: string;
}

export interface InitiateKycResponse {
  verification_id: string;
  status: string;
  message: string;
}
