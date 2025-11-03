-- ========================================
-- GIFT HUB システム拡張
-- ========================================
--
-- 目的:
-- 1. GIFT HUB本体をSupabaseで管理（localStorage脱却）
-- 2. 共通カタログ機能の実装
-- 3. HUBと商品の柔軟な紐づけ
--
-- 変更内容:
-- - vending_machines テーブル: GIFT HUB本体の設定
-- - products テーブル拡張: 共通カタログフラグ追加
-- - hub_products テーブル: HUBと商品の紐づけ（参照方式）
-- ========================================

-- ========================================
-- 1. vending_machines テーブル作成
-- ========================================
-- GIFT HUB本体の設定を管理
-- localStorage から Supabase へ移行

CREATE TABLE IF NOT EXISTS vending_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',

  -- 基本情報
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT,  -- メモフィールド（設置場所の記録用）
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- 統計情報
  total_sales NUMERIC DEFAULT 0,
  total_access_count INTEGER DEFAULT 0,
  total_distributions INTEGER DEFAULT 0,

  -- 設定（JSONB形式）
  -- VendingMachineSettings 型のデータを保存
  -- {
  --   theme, displayName, welcomeMessage, thankYouMessage,
  --   maxSelectionsPerUser, operatingHours, acceptedToken,
  --   paymentSplitterAddress, design: { ... }
  -- }
  settings JSONB NOT NULL DEFAULT '{}',

  -- メタデータ
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_vending_machines_tenant_id ON vending_machines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vending_machines_slug ON vending_machines(slug);
CREATE INDEX IF NOT EXISTS idx_vending_machines_is_active ON vending_machines(is_active);

-- ========================================
-- 2. products テーブル拡張
-- ========================================
-- 共通カタログ機能のためにカテゴリフラグを追加

-- category カラムを追加
ALTER TABLE products
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'hub_specific'
CHECK (category IN ('hub_specific', 'common_catalog'));

-- 共通カタログ商品用のインデックス
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- 既存商品はすべて 'hub_specific' に設定
UPDATE products
SET category = 'hub_specific'
WHERE category IS NULL;

-- ========================================
-- 3. hub_products テーブル作成
-- ========================================
-- GIFT HUBと商品の紐づけ（参照方式）
--
-- 使い方:
-- - HUB専用商品: products.tenant_id = hub.id, category = 'hub_specific'
-- - 共通カタログ商品: products.tenant_id = 'common', category = 'common_catalog'
--   → hub_products で各HUBに紐づけ

CREATE TABLE IF NOT EXISTS hub_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id UUID NOT NULL REFERENCES vending_machines(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- 表示設定
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,

  -- メタデータ
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 同じHUBに同じ商品を重複して追加できないように制約
  UNIQUE(hub_id, product_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_hub_products_hub_id ON hub_products(hub_id);
CREATE INDEX IF NOT EXISTS idx_hub_products_product_id ON hub_products(product_id);
CREATE INDEX IF NOT EXISTS idx_hub_products_display_order ON hub_products(hub_id, display_order);

-- ========================================
-- 4. RLS (Row Level Security) ポリシー
-- ========================================

-- vending_machines テーブル
ALTER TABLE vending_machines ENABLE ROW LEVEL SECURITY;

-- 全ユーザーがアクティブなHUBを読み取り可能
CREATE POLICY "Anyone can read active vending machines"
  ON vending_machines FOR SELECT
  USING (is_active = true);

-- サービスロールのみがHUBを挿入・更新可能
CREATE POLICY "Service role can insert vending machines"
  ON vending_machines FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update vending machines"
  ON vending_machines FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete vending machines"
  ON vending_machines FOR DELETE
  USING (auth.role() = 'service_role');

-- hub_products テーブル
ALTER TABLE hub_products ENABLE ROW LEVEL SECURITY;

-- 全ユーザーがHUB商品紐づけを読み取り可能
CREATE POLICY "Anyone can read hub products"
  ON hub_products FOR SELECT
  USING (true);

-- サービスロールのみがHUB商品紐づけを挿入・更新・削除可能
CREATE POLICY "Service role can insert hub products"
  ON hub_products FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update hub products"
  ON hub_products FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete hub products"
  ON hub_products FOR DELETE
  USING (auth.role() = 'service_role');

-- ========================================
-- 5. トリガー: updated_at の自動更新
-- ========================================

CREATE TRIGGER update_vending_machines_updated_at
  BEFORE UPDATE ON vending_machines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 6. ビュー: HUBの商品一覧取得（便利関数）
-- ========================================
--
-- 使い方: SELECT * FROM v_hub_products_full WHERE hub_id = 'xxx';
--
-- このビューは:
-- - HUB専用商品（products.tenant_id = hub.id）
-- - 共通カタログから追加された商品（hub_products経由）
-- を統合して返す

CREATE OR REPLACE VIEW v_hub_products_full AS
SELECT
  hp.hub_id,
  p.*,
  hp.display_order,
  hp.is_featured,
  CASE
    WHEN p.category = 'common_catalog' THEN 'common'
    ELSE 'hub_specific'
  END as source_type
FROM hub_products hp
INNER JOIN products p ON hp.product_id = p.id
WHERE p.is_active = true

UNION ALL

-- HUB専用商品（hub_products経由で追加されていないもの）
SELECT
  vm.id::uuid as hub_id,
  p.*,
  0 as display_order,
  false as is_featured,
  'hub_specific' as source_type
FROM vending_machines vm
INNER JOIN products p ON p.tenant_id = vm.id::text
WHERE p.is_active = true
  AND p.category = 'hub_specific'
  AND NOT EXISTS (
    SELECT 1 FROM hub_products hp
    WHERE hp.hub_id = vm.id AND hp.product_id = p.id
  );

-- ========================================
-- 7. ストアドプロシージャ: HUBに商品を追加
-- ========================================

CREATE OR REPLACE FUNCTION add_product_to_hub(
  p_hub_id UUID,
  p_product_id UUID,
  p_display_order INTEGER DEFAULT 0,
  p_is_featured BOOLEAN DEFAULT false
)
RETURNS BOOLEAN AS $$
BEGIN
  -- 既に追加されている場合はスキップ
  IF EXISTS (
    SELECT 1 FROM hub_products
    WHERE hub_id = p_hub_id AND product_id = p_product_id
  ) THEN
    RETURN false;
  END IF;

  -- HUBに商品を追加
  INSERT INTO hub_products (hub_id, product_id, display_order, is_featured)
  VALUES (p_hub_id, p_product_id, p_display_order, p_is_featured);

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 8. ストアドプロシージャ: HUBから商品を削除
-- ========================================

CREATE OR REPLACE FUNCTION remove_product_from_hub(
  p_hub_id UUID,
  p_product_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- HUBと商品の紐づけを削除
  DELETE FROM hub_products
  WHERE hub_id = p_hub_id AND product_id = p_product_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count > 0;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- マイグレーション完了
-- ========================================
--
-- 次のステップ:
-- 1. localStorage のデータを vending_machines テーブルに移行
-- 2. 共通カタログ管理UIの実装
-- 3. HUB商品紐づけUIの実装
--
-- ========================================
