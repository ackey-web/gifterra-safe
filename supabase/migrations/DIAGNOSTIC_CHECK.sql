-- ========================================
-- 診断クエリ: テーブル構造の確認
-- ========================================

-- 1. products テーブルの全カラムを確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
ORDER BY ordinal_position;

-- 2. vending_machines テーブルの全カラムを確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'vending_machines'
ORDER BY ordinal_position;

-- 3. products テーブルに tenant_uuid が何個あるか確認
SELECT
  COUNT(*) as tenant_uuid_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name = 'tenant_uuid';

-- 4. 既存のビューを確認
SELECT
  table_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'v_hub_products_with_tenant';
