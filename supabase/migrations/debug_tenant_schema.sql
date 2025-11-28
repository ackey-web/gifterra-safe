-- テナント関連テーブルのスキーマ確認用SQL

-- 1. tenant_applicationsテーブルの構造確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'tenant_applications'
ORDER BY ordinal_position;

-- 2. tenant_rank_plansテーブルの構造確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'tenant_rank_plans'
ORDER BY ordinal_position;

-- 3. tenant_applicationsの制約確認
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'tenant_applications';

-- 4. tenant_rank_plansの外部キー制約確認
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'tenant_rank_plans'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 5. 既存のデータ確認
SELECT
  applicant_address,
  tenant_name,
  status,
  tenant_id,
  rank_plan
FROM tenant_applications
WHERE applicant_address = '0x0174477a1fceb9de25289cd1ca48b6998c9cd7fc';
