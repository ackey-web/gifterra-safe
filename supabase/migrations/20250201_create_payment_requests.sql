-- Migration: Create payment_requests table for X402 QR payments
-- Date: 2025-02-01
-- Description: Stores payment request QR codes to prevent duplicate usage and track payment status

-- Create payment_requests table
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE NOT NULL,
  tenant_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  message TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  completed_by TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_requests_request_id ON payment_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_tenant_address ON payment_requests(tenant_address);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_expires_at ON payment_requests(expires_at);

-- Add RLS policies
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read their own payment requests
CREATE POLICY "Users can read their own payment requests"
  ON payment_requests
  FOR SELECT
  USING (tenant_address = lower(current_setting('request.jwt.claims', true)::json->>'wallet_address'));

-- Allow tenants to create payment requests
CREATE POLICY "Tenants can create payment requests"
  ON payment_requests
  FOR INSERT
  WITH CHECK (tenant_address = lower(current_setting('request.jwt.claims', true)::json->>'wallet_address'));

-- Allow anyone to update completed_by when completing payment
CREATE POLICY "Anyone can complete payment requests"
  ON payment_requests
  FOR UPDATE
  USING (status = 'pending' AND expires_at > NOW())
  WITH CHECK (status IN ('completed', 'expired', 'cancelled'));

-- Add comment for documentation
COMMENT ON TABLE payment_requests IS 'Stores X402 payment request QR codes to prevent duplicate usage and enable payment tracking';
COMMENT ON COLUMN payment_requests.request_id IS 'Unique identifier for the payment request (prevents duplicate usage)';
COMMENT ON COLUMN payment_requests.tenant_address IS 'Ethereum address of the tenant/merchant receiving payment';
COMMENT ON COLUMN payment_requests.amount IS 'Payment amount in JPYC (stored as string to preserve precision)';
COMMENT ON COLUMN payment_requests.message IS 'Optional message/memo for the payment';
COMMENT ON COLUMN payment_requests.expires_at IS 'Expiration timestamp for the payment request';
COMMENT ON COLUMN payment_requests.status IS 'Payment status: pending, completed, expired, or cancelled';
COMMENT ON COLUMN payment_requests.completed_by IS 'Ethereum address of the user who completed the payment';
COMMENT ON COLUMN payment_requests.completed_at IS 'Timestamp when payment was completed';
