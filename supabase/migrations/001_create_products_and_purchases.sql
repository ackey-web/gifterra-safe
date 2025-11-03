-- GIFT HUB 購入システム用テーブル

-- products テーブル: 商品情報
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  content_path TEXT NOT NULL, -- downloads/{tenantId}/... へのパス
  price_token TEXT NOT NULL DEFAULT '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea', -- tNHT
  price_amount_wei TEXT NOT NULL, -- 価格（wei単位、文字列で保存）
  stock INTEGER NOT NULL DEFAULT 0,
  is_unlimited BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- purchases テーブル: 購入履歴
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer TEXT NOT NULL, -- ウォレットアドレス
  tx_hash TEXT NOT NULL UNIQUE, -- トランザクションハッシュ（一意制約で冪等性を保証）
  amount_wei TEXT NOT NULL, -- 支払額（wei単位）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON purchases(buyer);
CREATE INDEX IF NOT EXISTS idx_purchases_tx_hash ON purchases(tx_hash);

-- RLS (Row Level Security) ポリシー
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが商品を読み取り可能
CREATE POLICY "Anyone can read active products"
  ON products FOR SELECT
  USING (is_active = true);

-- サービスロールのみが商品を挿入・更新可能
CREATE POLICY "Service role can insert products"
  ON products FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update products"
  ON products FOR UPDATE
  USING (auth.role() = 'service_role');

-- 購入者は自分の購入履歴を読み取り可能
CREATE POLICY "Users can read their own purchases"
  ON purchases FOR SELECT
  USING (buyer = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- サービスロールのみが購入履歴を挿入可能
CREATE POLICY "Service role can insert purchases"
  ON purchases FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 更新時刻の自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 在庫減少用のストアドプロシージャ（原子的な更新）
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID)
RETURNS TABLE(success BOOLEAN, remaining_stock INTEGER) AS $$
DECLARE
  v_is_unlimited BOOLEAN;
  v_current_stock INTEGER;
BEGIN
  -- 商品情報を取得してロック
  SELECT is_unlimited, stock INTO v_is_unlimited, v_current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  -- 無制限在庫の場合
  IF v_is_unlimited THEN
    RETURN QUERY SELECT true, -1;
    RETURN;
  END IF;

  -- 在庫がない場合
  IF v_current_stock <= 0 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  -- 在庫を1減らす
  UPDATE products
  SET stock = stock - 1
  WHERE id = p_product_id;

  -- 更新後の在庫数を返す
  SELECT stock INTO v_current_stock
  FROM products
  WHERE id = p_product_id;

  RETURN QUERY SELECT true, v_current_stock;
END;
$$ LANGUAGE plpgsql;
