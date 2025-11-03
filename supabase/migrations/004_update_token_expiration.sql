-- ダウンロードトークンの有効期限を15分から24時間に変更
-- このマイグレーションは既存のデータベースに対して関数を更新します

CREATE OR REPLACE FUNCTION create_download_token(
  p_purchase_id UUID,
  p_product_id UUID,
  p_ttl_seconds INTEGER DEFAULT 86400 -- デフォルト24時間（変更: 15分 → 24時間）
)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
  v_buyer TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 購入情報から購入者アドレスを取得
  SELECT buyer INTO v_buyer
  FROM purchases
  WHERE id = p_purchase_id;

  IF v_buyer IS NULL THEN
    RAISE EXCEPTION 'Purchase not found: %', p_purchase_id;
  END IF;

  -- ランダムトークンを生成（UUID v4）
  v_token := gen_random_uuid()::TEXT;

  -- 有効期限を設定
  v_expires_at := NOW() + (p_ttl_seconds || ' seconds')::INTERVAL;

  -- トークンをINSERT
  INSERT INTO download_tokens (
    token,
    purchase_id,
    product_id,
    buyer,
    expires_at
  ) VALUES (
    v_token,
    p_purchase_id,
    p_product_id,
    v_buyer,
    v_expires_at
  );

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
