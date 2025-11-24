-- Migration: Add gasless payment support to payment_requests
-- Date: 2025-02-11
-- Description: Extends payment_requests table to support EIP-3009 transferWithAuthorization (gasless payments)

-- Add new columns for gasless payment (EIP-3009)
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'invoice' CHECK (payment_type IN ('invoice', 'wallet', 'authorization')),
  ADD COLUMN IF NOT EXISTS nonce TEXT,
  ADD COLUMN IF NOT EXISTS valid_after BIGINT,
  ADD COLUMN IF NOT EXISTS valid_before BIGINT,
  ADD COLUMN IF NOT EXISTS signature_v INTEGER,
  ADD COLUMN IF NOT EXISTS signature_r TEXT,
  ADD COLUMN IF NOT EXISTS signature_s TEXT,
  ADD COLUMN IF NOT EXISTS signature_received_at TIMESTAMP WITH TIME ZONE;

-- Add index for nonce (used for replay attack prevention)
CREATE INDEX IF NOT EXISTS idx_payment_requests_nonce ON payment_requests(nonce) WHERE nonce IS NOT NULL;

-- Add index for payment_type
CREATE INDEX IF NOT EXISTS idx_payment_requests_payment_type ON payment_requests(payment_type);

-- Add comments for new columns
COMMENT ON COLUMN payment_requests.payment_type IS 'Payment type: invoice (X402), wallet (manual amount), or authorization (gasless EIP-3009)';
COMMENT ON COLUMN payment_requests.nonce IS 'EIP-3009 nonce (32 bytes hex) for gasless payments, prevents replay attacks';
COMMENT ON COLUMN payment_requests.valid_after IS 'EIP-3009 valid_after timestamp (Unix seconds)';
COMMENT ON COLUMN payment_requests.valid_before IS 'EIP-3009 valid_before timestamp (Unix seconds)';
COMMENT ON COLUMN payment_requests.signature_v IS 'EIP-712 signature v component';
COMMENT ON COLUMN payment_requests.signature_r IS 'EIP-712 signature r component';
COMMENT ON COLUMN payment_requests.signature_s IS 'EIP-712 signature s component';
COMMENT ON COLUMN payment_requests.signature_received_at IS 'Timestamp when user signature was received';

-- Update table comment
COMMENT ON TABLE payment_requests IS 'Stores payment request QR codes (X402, wallet, and gasless EIP-3009) to prevent duplicate usage and enable payment tracking';
