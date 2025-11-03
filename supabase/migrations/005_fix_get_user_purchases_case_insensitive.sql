-- ===================================================================
-- get_user_purchases 関数を大文字小文字を区別しないように修正
-- ===================================================================
-- 問題: データベースにはチェックサムアドレス(大文字小文字混在)が保存されているが、
--       クエリは小文字で実行されるため一致しない
-- 解決: LOWER()関数を使って大文字小文字を無視して比較

CREATE OR REPLACE FUNCTION get_user_purchases(p_buyer TEXT)
RETURNS TABLE(
  purchase_id UUID,
  product_id UUID,
  product_name TEXT,
  purchased_at TIMESTAMPTZ,
  has_valid_token BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS purchase_id,
    pr.id AS product_id,
    pr.name AS product_name,
    p.created_at AS purchased_at,
    EXISTS(
      SELECT 1
      FROM download_tokens dt
      WHERE dt.purchase_id = p.id
        AND dt.is_consumed = false
        AND dt.expires_at > NOW()
    ) AS has_valid_token
  FROM purchases p
  INNER JOIN products pr ON p.product_id = pr.id
  WHERE LOWER(p.buyer) = LOWER(p_buyer)  -- 大文字小文字を無視して比較
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
