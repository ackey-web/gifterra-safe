// EIP-3009 Gasless Payment Types

export interface GaslessPaymentRequest {
  id: string;
  pin: string;
  nonce: string;
  merchant_address: string;
  amount: string;
  from_address: string | null;
  signature_v: number | null;
  signature_r: string | null;
  signature_s: string | null;
  valid_after: number;
  valid_before: number;
  status: 'pending' | 'signed' | 'completed' | 'expired' | 'failed';
  error_message: string | null;
  created_at: string;
  signed_at: string | null;
  completed_at: string | null;
}

export interface CreateGaslessPaymentRequest {
  pin: string;
  nonce: string;
  merchant_address: string;
  amount: string;
  valid_before: number;
  valid_after?: number;
}

export interface SignGaslessPaymentRequest {
  from_address: string;
  signature_v: number;
  signature_r: string;
  signature_s: string;
}

// EIP-3009 TransferWithAuthorization typed data
export interface EIP3009TypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    TransferWithAuthorization: Array<{
      name: string;
      type: string;
    }>;
  };
  primaryType: 'TransferWithAuthorization';
  message: {
    from: string;
    to: string;
    value: string;
    validAfter: number;
    validBefore: number;
    nonce: string;
  };
}
