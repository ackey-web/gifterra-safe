-- ===================================================================
-- 購入履歴とトークンをデバッグするクエリ
-- ===================================================================
-- 最近の購入履歴を確認します（直近10件）

SELECT
  p.id AS purchase_id,
  p.buyer,
  p.product_id,
  pr.name AS product_name,
  p.created_at AS purchased_at,
  -- トークン情報
  dt.token,
  dt.expires_at,
  dt.is_consumed,
  -- 有効なトークンかどうか
  (dt.expires_at > NOW() AND dt.is_consumed = false) AS is_valid_token
FROM purchases p
LEFT JOIN products pr ON p.product_id = pr.id
LEFT JOIN download_tokens dt ON dt.purchase_id = p.id
ORDER BY p.created_at DESC
LIMIT 10;

-- ===================================================================
-- get_user_purchases 関数のテスト
-- ===================================================================
-- 以下のクエリで、あなたのウォレットアドレスの購入履歴を確認できます
-- YOUR_ADDRESS_HERE を実際のウォレットアドレス（小文字）に置き換えてください

-- SELECT * FROM get_user_purchases('YOUR_ADDRESS_HERE');

-- 例: SELECT * FROM get_user_purchases('0x66f1274ad5d042b7571c2efa943370dbcd3459ab');
