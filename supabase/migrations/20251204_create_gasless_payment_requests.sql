-- Create gasless_payment_requests table for EIP-3009 based gasless payments
-- This table stores temporary payment request data with auto-cleanup

CREATE TABLE IF NOT EXISTS gasless_payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Payment identification
  pin TEXT NOT NULL UNIQUE,
  nonce TEXT NOT NULL UNIQUE,

  -- Payment details
  merchant_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  from_address TEXT,  -- Set after user signs

  -- EIP-3009 signature components
  signature_v INTEGER,
  signature_r TEXT,
  signature_s TEXT,

  -- Validity
  valid_after BIGINT NOT NULL DEFAULT 0,
  valid_before BIGINT NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, signed, completed, expired, failed
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  signed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'signed', 'completed', 'expired', 'failed'))
);

-- Indexes for performance
CREATE INDEX idx_gasless_payment_pin ON gasless_payment_requests(pin);
CREATE INDEX idx_gasless_payment_status ON gasless_payment_requests(status);
CREATE INDEX idx_gasless_payment_valid_before ON gasless_payment_requests(valid_before);
CREATE INDEX idx_gasless_payment_merchant ON gasless_payment_requests(merchant_address);
CREATE INDEX idx_gasless_payment_nonce ON gasless_payment_requests(nonce);

-- RLS policies
ALTER TABLE gasless_payment_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can read pending/signed requests (needed for user to find by PIN)
CREATE POLICY "公開読み取り可能" ON gasless_payment_requests
  FOR SELECT
  USING (
    status IN ('pending', 'signed')
    AND valid_before > EXTRACT(EPOCH FROM NOW())
  );

-- Anyone can insert (for terminal UI to create requests)
CREATE POLICY "公開書き込み可能" ON gasless_payment_requests
  FOR INSERT
  WITH CHECK (true);

-- Anyone can update their own pending/signed requests
CREATE POLICY "公開更新可能" ON gasless_payment_requests
  FOR UPDATE
  USING (
    status IN ('pending', 'signed')
    AND valid_before > EXTRACT(EPOCH FROM NOW())
  );

-- Enable pg_cron extension for automatic cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Auto-delete expired requests (runs every 10 minutes)
SELECT cron.schedule(
  'delete-expired-gasless-payment-requests',
  '*/10 * * * *',
  $$
  DELETE FROM gasless_payment_requests
  WHERE (
    valid_before < EXTRACT(EPOCH FROM NOW())
    AND status NOT IN ('completed', 'failed')
  )
  OR (
    status = 'pending'
    AND created_at < NOW() - INTERVAL '30 minutes'
  );
  $$
);

-- Auto-delete old completed/failed requests (runs daily at 3am)
SELECT cron.schedule(
  'delete-old-completed-gasless-requests',
  '0 3 * * *',
  $$
  DELETE FROM gasless_payment_requests
  WHERE status IN ('completed', 'failed', 'expired')
  AND completed_at < NOW() - INTERVAL '24 hours';
  $$
);

-- Add comment
COMMENT ON TABLE gasless_payment_requests IS 'Temporary storage for EIP-3009 gasless payment requests with automatic cleanup';
