-- ========================================
-- テナントUUID列の追加と既存データのマイグレーション（安全版）
-- ========================================
--
-- 目的:
-- 1. vending_machines.tenant_uuid (UUID型) を追加
-- 2. products.tenant_uuid と hub_id を追加
-- 3. tenant_id (TEXT) から tenant_uuid (UUID) への段階的移行
--
-- 完全な冪等性:
-- - 既存のカラム、インデックス、制約をチェック
-- - 存在する場合はスキップ
-- ========================================

-- ========================================
-- 1. vending_machines テーブルに tenant_uuid を追加
-- ========================================

DO $$
BEGIN
  -- tenant_uuid カラムを追加（存在しない場合のみ）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vending_machines'
      AND column_name = 'tenant_uuid'
  ) THEN
    ALTER TABLE vending_machines ADD COLUMN tenant_uuid UUID;
    RAISE NOTICE 'Added tenant_uuid column to vending_machines';
  ELSE
    RAISE NOTICE 'Column tenant_uuid already exists in vending_machines';
  END IF;

  -- インデックス作成（存在しない場合のみ）
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'vending_machines'
      AND indexname = 'idx_vending_machines_tenant_uuid'
  ) THEN
    CREATE INDEX idx_vending_machines_tenant_uuid ON vending_machines(tenant_uuid);
    RAISE NOTICE 'Created index idx_vending_machines_tenant_uuid';
  ELSE
    RAISE NOTICE 'Index idx_vending_machines_tenant_uuid already exists';
  END IF;
END $$;

-- コメント追加（既存の場合は上書き）
COMMENT ON COLUMN vending_machines.tenant_id IS 'DEPRECATED: Use tenant_uuid instead. Legacy TEXT column for backward compatibility.';
COMMENT ON COLUMN vending_machines.tenant_uuid IS 'Tenant UUID from tenant_applications.tenant_id. NULL for legacy data.';

-- ========================================
-- 2. products テーブルに tenant_uuid と hub_id を追加
-- ========================================

DO $$
BEGIN
  -- tenant_uuid カラムを追加（存在しない場合のみ）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'tenant_uuid'
  ) THEN
    ALTER TABLE products ADD COLUMN tenant_uuid UUID;
    RAISE NOTICE 'Added tenant_uuid column to products';
  ELSE
    RAISE NOTICE 'Column tenant_uuid already exists in products';
  END IF;

  -- hub_id カラムを追加（存在しない場合のみ）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'hub_id'
  ) THEN
    ALTER TABLE products ADD COLUMN hub_id UUID;
    RAISE NOTICE 'Added hub_id column to products';
  ELSE
    RAISE NOTICE 'Column hub_id already exists in products';
  END IF;

  -- 外部キー制約を追加（存在しない場合のみ）
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_hub_id_fkey'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_hub_id_fkey
    FOREIGN KEY (hub_id) REFERENCES vending_machines(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added foreign key constraint products_hub_id_fkey';
  ELSE
    RAISE NOTICE 'Foreign key constraint products_hub_id_fkey already exists';
  END IF;

  -- インデックス作成（存在しない場合のみ）
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND indexname = 'idx_products_tenant_uuid'
  ) THEN
    CREATE INDEX idx_products_tenant_uuid ON products(tenant_uuid);
    RAISE NOTICE 'Created index idx_products_tenant_uuid';
  ELSE
    RAISE NOTICE 'Index idx_products_tenant_uuid already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND indexname = 'idx_products_hub_id'
  ) THEN
    CREATE INDEX idx_products_hub_id ON products(hub_id);
    RAISE NOTICE 'Created index idx_products_hub_id';
  ELSE
    RAISE NOTICE 'Index idx_products_hub_id already exists';
  END IF;
END $$;

-- コメント追加（既存の場合は上書き）
COMMENT ON COLUMN products.tenant_id IS 'DEPRECATED: Use tenant_uuid instead. Legacy TEXT column containing machine ID or tenant UUID as text.';
COMMENT ON COLUMN products.tenant_uuid IS 'Tenant UUID from tenant_applications.tenant_id. Links products to tenants.';
COMMENT ON COLUMN products.hub_id IS 'GIFT HUB UUID from vending_machines.id. Links products to specific hubs.';

-- ========================================
-- 3. 既存データのマイグレーション
-- ========================================

-- vending_machines: tenant_id が UUID 形式の場合は tenant_uuid にコピー
UPDATE vending_machines
SET tenant_uuid = tenant_id::uuid
WHERE tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND tenant_uuid IS NULL;

-- products: tenant_id が UUID 形式の場合は tenant_uuid にコピー
UPDATE products
SET tenant_uuid = tenant_id::uuid
WHERE tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND tenant_uuid IS NULL;

-- products: tenant_id が vending_machines.id と一致する場合は hub_id を設定
UPDATE products p
SET
  hub_id = vm.id,
  tenant_uuid = vm.tenant_uuid
FROM vending_machines vm
WHERE p.tenant_id = vm.id::text
  AND p.hub_id IS NULL
  AND vm.tenant_uuid IS NOT NULL;

-- ========================================
-- 4. ビュー: HUBの商品一覧取得（tenant_uuid対応版）
-- ========================================

CREATE OR REPLACE VIEW v_hub_products_with_tenant AS
SELECT
  p.*,
  vm.tenant_uuid,
  vm.slug as hub_slug,
  vm.name as hub_name,
  CASE
    WHEN p.category = 'common_catalog' THEN 'common'
    WHEN p.hub_id IS NOT NULL THEN 'hub_specific'
    ELSE 'legacy'
  END as product_source
FROM products p
LEFT JOIN vending_machines vm ON p.hub_id = vm.id
WHERE p.is_active = true;

COMMENT ON VIEW v_hub_products_with_tenant IS 'Products with tenant UUID and hub information for proper tenant isolation';

-- ========================================
-- 5. ヘルパー関数: テナントのGIFT HUB数取得
-- ========================================

CREATE OR REPLACE FUNCTION get_tenant_hub_count(p_tenant_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM vending_machines
  WHERE tenant_uuid = p_tenant_uuid
    AND is_active = true;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_tenant_hub_count IS 'Get active GIFT HUB count for a tenant by UUID';

-- ========================================
-- 6. ヘルパー関数: テナントの全商品取得
-- ========================================

CREATE OR REPLACE FUNCTION get_tenant_products(p_tenant_uuid UUID)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  hub_id UUID,
  hub_name TEXT,
  price_token TEXT,
  price_amount_wei TEXT,
  category TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as product_id,
    p.name as product_name,
    p.hub_id,
    vm.name as hub_name,
    p.price_token,
    p.price_amount_wei,
    p.category
  FROM products p
  LEFT JOIN vending_machines vm ON p.hub_id = vm.id
  WHERE p.tenant_uuid = p_tenant_uuid
    AND p.is_active = true
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_tenant_products IS 'Get all active products for a tenant by UUID';

-- ========================================
-- 7. マイグレーション検証ビュー
-- ========================================

CREATE OR REPLACE VIEW v_migration_status AS
SELECT
  'vending_machines' as table_name,
  COUNT(*) as total_rows,
  COUNT(tenant_uuid) as migrated_rows,
  COUNT(*) - COUNT(tenant_uuid) as pending_rows,
  ROUND(100.0 * COUNT(tenant_uuid) / NULLIF(COUNT(*), 0), 2) as migration_percentage
FROM vending_machines
UNION ALL
SELECT
  'products' as table_name,
  COUNT(*) as total_rows,
  COUNT(tenant_uuid) as migrated_rows,
  COUNT(*) - COUNT(tenant_uuid) as pending_rows,
  ROUND(100.0 * COUNT(tenant_uuid) / NULLIF(COUNT(*), 0), 2) as migration_percentage
FROM products;

COMMENT ON VIEW v_migration_status IS 'Check migration progress from tenant_id (TEXT) to tenant_uuid (UUID)';

-- ========================================
-- マイグレーション完了
-- ========================================
--
-- 次のステップ:
-- 1. アプリケーション側で tenant_uuid を優先使用
-- 2. LocalStorageからSupabaseへの移行時に tenant_uuid を設定
-- 3. 全データ移行完了後、tenant_id を非推奨化
-- 4. 将来的に tenant_id を削除（メジャーバージョンアップ時）
--
-- 確認方法:
-- SELECT * FROM v_migration_status;
-- SELECT * FROM get_tenant_hub_count('your-tenant-uuid');
-- ========================================
