-- Migration: Add gasless payment status values
-- Date: 2025-02-11
-- Description: Extends payment_requests status enum to support gasless payment workflow

-- Drop existing constraint
ALTER TABLE payment_requests
  DROP CONSTRAINT IF EXISTS payment_requests_status_check;

-- Add new constraint with gasless payment statuses
ALTER TABLE payment_requests
  ADD CONSTRAINT payment_requests_status_check
  CHECK (status IN (
    'pending',           -- 従来: 請求書QR待機中
    'awaiting_signature', -- ガスレス: ユーザーの署名待ち
    'signature_received', -- ガスレス: 署名受信済み、店舗が実行待ち
    'completed',         -- 決済完了
    'expired',           -- 有効期限切れ
    'cancelled'          -- キャンセル
  ));

-- Add comment for status values
COMMENT ON COLUMN payment_requests.status IS 'Payment status: pending (invoice QR), awaiting_signature (gasless waiting for user signature), signature_received (gasless signature received), completed, expired, or cancelled';
