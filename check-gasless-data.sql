-- Supabase gasless_payment_requests テーブルの最新データを確認

-- 最新のレコードを表示（署名データ含む）
SELECT
  id,
  pin,
  merchant_address,
  from_address,
  amount,
  nonce,
  valid_after,
  valid_before,
  signature_v,
  LEFT(signature_r, 20) || '...' as signature_r_preview,
  LEFT(signature_s, 20) || '...' as signature_s_preview,
  status,
  created_at,
  signed_at,
  completed_at
FROM gasless_payment_requests
ORDER BY created_at DESC
LIMIT 5;

-- アドレス形式をチェック（大文字小文字の確認）
SELECT
  pin,
  merchant_address,
  from_address,
  -- merchant_addressに大文字が含まれているかチェック
  CASE
    WHEN merchant_address ~ '[A-F]' THEN 'HAS UPPERCASE'
    ELSE 'all lowercase'
  END as merchant_format,
  -- from_addressに大文字が含まれているかチェック
  CASE
    WHEN from_address ~ '[A-F]' THEN 'HAS UPPERCASE'
    ELSE 'all lowercase'
  END as from_format,
  status
FROM gasless_payment_requests
ORDER BY created_at DESC
LIMIT 5;

-- 署名済みのレコードのみ表示
SELECT
  pin,
  merchant_address,
  from_address,
  amount,
  signature_v,
  status
FROM gasless_payment_requests
WHERE status = 'signed'
ORDER BY signed_at DESC
LIMIT 3;
