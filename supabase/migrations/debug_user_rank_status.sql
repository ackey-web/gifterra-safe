-- デバッグ: 0x66F1274aD5d042b7571C2EfA943370dbcd3459aB のランクプラン状態確認

-- 1. tenant_applications の状態確認
SELECT
  'tenant_applications' as table_name,
  applicant_address,
  tenant_id,
  rank_plan,
  status,
  created_at,
  updated_at
FROM tenant_applications
WHERE LOWER(applicant_address) = LOWER('0x66F1274aD5d042b7571C2EfA943370dbcd3459aB');

-- 2. tenant_rank_plans の状態確認
SELECT
  'tenant_rank_plans' as table_name,
  trp.tenant_id,
  trp.rank_plan,
  trp.is_active,
  trp.subscription_start_date,
  trp.updated_by,
  trp.created_at,
  trp.updated_at
FROM tenant_rank_plans trp
JOIN tenant_applications ta ON trp.tenant_id = ta.tenant_id
WHERE LOWER(ta.applicant_address) = LOWER('0x66F1274aD5d042b7571C2EfA943370dbcd3459aB');

-- 3. tenant_rank_plans テーブルの全カラム構造確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'tenant_rank_plans'
ORDER BY ordinal_position;
