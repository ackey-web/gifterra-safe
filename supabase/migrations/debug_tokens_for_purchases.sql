-- ===================================================================
-- 特定の購入IDに対するトークンを確認
-- ===================================================================
-- コンソールに表示された8個のpurchase_idに対するトークンを確認します

SELECT
  dt.token,
  dt.purchase_id,
  dt.buyer,
  dt.is_consumed,
  dt.expires_at,
  dt.created_at,
  -- 有効期限チェック
  (dt.expires_at > NOW()) AS is_not_expired,
  -- 現在時刻との差分
  EXTRACT(EPOCH FROM (dt.expires_at - NOW())) / 3600 AS hours_until_expiry
FROM download_tokens dt
WHERE dt.purchase_id IN (
  '12442c60-8f13-49ac-b08f-41c13920e0ae',
  '1c47d14b-dd45-4abd-8c43-1dbd28367f3c',
  'def7e8eb-3d90-494e-b669-c2fb03398f63',
  '809e18c9-b376-4c98-b319-a12e96c2940f',
  'dce8e6e5-162b-439e-aba5-a5ef51b4fbbd',
  '0eafaf45-8422-40fb-980e-f5efcbad692f',
  '23337913-4778-489c-9e33-fb66d43df28e',
  'c9f1427b-2814-41ee-92a6-a7435364ea67'
)
ORDER BY dt.created_at DESC;

-- ===================================================================
-- もしトークンが1件も見つからない場合、購入テーブルを確認
-- ===================================================================

SELECT
  p.id AS purchase_id,
  p.buyer,
  p.product_id,
  pr.name AS product_name,
  p.created_at,
  -- このpurchase_idに対するトークンの数
  (SELECT COUNT(*) FROM download_tokens WHERE purchase_id = p.id) AS token_count
FROM purchases p
LEFT JOIN products pr ON p.product_id = pr.id
WHERE p.id IN (
  '12442c60-8f13-49ac-b08f-41c13920e0ae',
  '1c47d14b-dd45-4abd-8c43-1dbd28367f3c',
  'def7e8eb-3d90-494e-b669-c2fb03398f63',
  '809e18c9-b376-4c98-b319-a12e96c2940f',
  'dce8e6e5-162b-439e-aba5-a5ef51b4fbbd',
  '0eafaf45-8422-40fb-980e-f5efcbad692f',
  '23337913-4778-489c-9e33-fb66d43df28e',
  'c9f1427b-2814-41ee-92a6-a7435364ea67'
)
ORDER BY p.created_at DESC;
