-- Add payment_type column to payment_requests table
-- Supports both invoice QR (従来方式) and wallet QR

-- Add payment_type column
ALTER TABLE payment_requests
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'invoice'
CHECK (payment_type IN ('invoice', 'wallet'));

-- Add paid_from_address column (nullable - wallet QR では記録しない)
ALTER TABLE payment_requests
ADD COLUMN IF NOT EXISTS paid_from_address TEXT;

-- Add transaction_hash column for blockchain verification
ALTER TABLE payment_requests
ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_payment_requests_payment_type ON payment_requests(payment_type);
CREATE INDEX IF NOT EXISTS idx_payment_requests_transaction_hash ON payment_requests(transaction_hash);

-- Update existing records to have payment_type = 'invoice'
UPDATE payment_requests
SET payment_type = 'invoice'
WHERE payment_type IS NULL;

-- Add comment
COMMENT ON COLUMN payment_requests.payment_type IS 'Payment method: invoice (請求書QR) or wallet (ウォレットQR)';
COMMENT ON COLUMN payment_requests.paid_from_address IS 'Customer wallet address (NULL for wallet QR to protect privacy)';
COMMENT ON COLUMN payment_requests.transaction_hash IS 'Blockchain transaction hash for verification';
