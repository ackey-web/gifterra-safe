-- ========================================
-- テナントUUID列のクリーンアップ
-- ========================================
--
-- 目的:
-- 部分的に実行されたマイグレーションをクリーンアップ
-- このスクリプトを実行してから、本マイグレーションを実行してください
--
-- ⚠️ 警告:
-- このスクリプトは既存のtenant_uuidとhub_idのデータを削除します
-- 本番環境では慎重に実行してください
-- ========================================

-- ========================================
-- 1. 診断: 現在の状態を確認
-- ========================================

DO $$
DECLARE
  vm_tenant_uuid_exists BOOLEAN;
  p_tenant_uuid_exists BOOLEAN;
  p_hub_id_exists BOOLEAN;
BEGIN
  -- vending_machines.tenant_uuid の存在確認
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vending_machines'
      AND column_name = 'tenant_uuid'
  ) INTO vm_tenant_uuid_exists;

  -- products.tenant_uuid の存在確認
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products'
      AND column_name = 'tenant_uuid'
  ) INTO p_tenant_uuid_exists;

  -- products.hub_id の存在確認
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products'
      AND column_name = 'hub_id'
  ) INTO p_hub_id_exists;

  -- 診断結果を出力
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Current Database State:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'vending_machines.tenant_uuid exists: %', vm_tenant_uuid_exists;
  RAISE NOTICE 'products.tenant_uuid exists: %', p_tenant_uuid_exists;
  RAISE NOTICE 'products.hub_id exists: %', p_hub_id_exists;
  RAISE NOTICE '========================================';
END $$;

-- ========================================
-- 2. クリーンアップ: ビューと関数を削除
-- ========================================

DROP VIEW IF EXISTS v_migration_status CASCADE;
DROP VIEW IF EXISTS v_hub_products_with_tenant CASCADE;
DROP FUNCTION IF EXISTS get_tenant_hub_count(UUID);
DROP FUNCTION IF EXISTS get_tenant_products(UUID);

-- ========================================
-- 3. クリーンアップ: インデックスを削除
-- ========================================

DROP INDEX IF EXISTS idx_vending_machines_tenant_uuid;
DROP INDEX IF EXISTS idx_products_tenant_uuid;
DROP INDEX IF EXISTS idx_products_hub_id;

-- ========================================
-- 4. クリーンアップ: 制約を削除
-- ========================================

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_hub_id_fkey;

-- ========================================
-- 5. クリーンアップ: カラムを削除
-- ========================================

ALTER TABLE vending_machines DROP COLUMN IF EXISTS tenant_uuid;
ALTER TABLE products DROP COLUMN IF EXISTS tenant_uuid;
ALTER TABLE products DROP COLUMN IF EXISTS hub_id;

-- ========================================
-- クリーンアップ完了
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Cleanup completed successfully!';
  RAISE NOTICE 'You can now run the main migration:';
  RAISE NOTICE '  20250301000001_add_tenant_uuid_columns_safe.sql';
  RAISE NOTICE '========================================';
END $$;
