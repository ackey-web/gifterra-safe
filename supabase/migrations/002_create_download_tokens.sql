-- ワンタイムダウンロードトークン用テーブル
-- 購入者専用・1回限りのダウンロードを保証

CREATE TABLE IF NOT EXISTS download_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE, -- ランダム生成されたトークン（UUID v4）
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer TEXT NOT NULL, -- ウォレットアドレス（購入者検証用）
  is_consumed BOOLEAN NOT NULL DEFAULT false, -- 使用済みフラグ
  expires_at TIMESTAMPTZ NOT NULL, -- 有効期限
  consumed_at TIMESTAMPTZ, -- 使用日時
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_download_tokens_token ON download_tokens(token);
CREATE INDEX IF NOT EXISTS idx_download_tokens_purchase_id ON download_tokens(purchase_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_buyer ON download_tokens(buyer);
CREATE INDEX IF NOT EXISTS idx_download_tokens_expires_at ON download_tokens(expires_at);

-- RLS (Row Level Security) ポリシー
ALTER TABLE download_tokens ENABLE ROW LEVEL SECURITY;

-- サービスロールのみが全操作可能
CREATE POLICY "download_tokens: Service Role Full Access"
  ON download_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 購入者は自分のトークンを読み取り可能（将来のUI用）
CREATE POLICY "download_tokens: Buyers can read their own tokens"
  ON download_tokens FOR SELECT
  TO public
  USING (buyer = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- ==========================================
-- ストアドプロシージャ: ダウンロードトークン生成
-- ==========================================
-- 購入完了時に呼び出される
-- 戻り値: 生成されたトークン文字列

CREATE OR REPLACE FUNCTION create_download_token(
  p_purchase_id UUID,
  p_product_id UUID,
  p_ttl_seconds INTEGER DEFAULT 86400 -- デフォルト24時間
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

-- ==========================================
-- ストアドプロシージャ: ダウンロードトークン検証・消費
-- ==========================================
-- ダウンロードAPI呼び出し時に使用
-- トークンを検証し、1回限りの使用を保証
-- 戻り値: トークン情報（product_id, buyer）

CREATE OR REPLACE FUNCTION consume_download_token(p_token TEXT)
RETURNS TABLE(product_id UUID, buyer TEXT) AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- トークンを取得してロック（FOR UPDATE でトランザクション保証）
  SELECT * INTO v_token_record
  FROM download_tokens
  WHERE token = p_token
  FOR UPDATE;

  -- トークンが存在しない
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token not found';
  END IF;

  -- 既に使用済み
  IF v_token_record.is_consumed THEN
    RAISE EXCEPTION 'Token already consumed';
  END IF;

  -- 有効期限切れ
  IF v_token_record.expires_at < NOW() THEN
    RAISE EXCEPTION 'Token expired';
  END IF;

  -- トークンを消費（使用済みマーク）
  UPDATE download_tokens
  SET
    is_consumed = true,
    consumed_at = NOW()
  WHERE token = p_token;

  -- 商品IDと購入者を返す
  RETURN QUERY
  SELECT v_token_record.product_id, v_token_record.buyer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- クリーンアップ関数: 期限切れトークンの削除
-- ==========================================
-- 定期実行（cron）で使用することを推奨
-- 24時間以上経過した期限切れトークンを削除

CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM download_tokens
  WHERE expires_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 購入者のダウンロード履歴を取得する関数
-- ==========================================
-- 将来のUI用（購入済み商品一覧）

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
  WHERE p.buyer = p_buyer
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
