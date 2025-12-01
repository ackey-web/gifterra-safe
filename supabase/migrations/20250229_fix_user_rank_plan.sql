-- Fix tenant rank plan to STUDIO_PRO_MAX for ELEVEN BASS LAB.
-- ELEVEN BASS LAB. (0x66F1274aD5d042b7571C2EfA943370dbcd3459aB) のランクプランをSTUDIO_PRO_MAXに修正

DO $$
DECLARE
  user_address TEXT := '0x66F1274aD5d042b7571C2EfA943370dbcd3459aB';
  user_tenant_id UUID;
BEGIN
  -- 1. tenant_applicationsからtenant_idを取得
  SELECT tenant_id INTO user_tenant_id
  FROM tenant_applications
  WHERE LOWER(applicant_address) = LOWER(user_address)
    AND status = 'approved';

  IF user_tenant_id IS NULL THEN
    RAISE NOTICE 'No approved tenant found for address: %', user_address;
    RETURN;
  END IF;

  RAISE NOTICE 'Found tenant_id: % for address: %', user_tenant_id, user_address;

  -- 2. tenant_applicationsのrank_planを更新
  UPDATE tenant_applications
  SET rank_plan = 'STUDIO_PRO_MAX'
  WHERE LOWER(applicant_address) = LOWER(user_address)
    AND status = 'approved';

  RAISE NOTICE 'Updated tenant_applications.rank_plan to STUDIO_PRO_MAX';

  -- 3. tenant_rank_plansを更新
  -- 既存のレコードを削除して新しいプランを挿入
  INSERT INTO tenant_rank_plans (
    tenant_id,
    rank_plan,
    is_active,
    subscription_start_date,
    updated_by
  ) VALUES (
    user_tenant_id,
    'STUDIO_PRO_MAX',
    true,
    CURRENT_DATE,
    user_address
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    rank_plan = 'STUDIO_PRO_MAX',
    is_active = true,
    subscription_start_date = CURRENT_DATE,
    updated_by = user_address,
    updated_at = CURRENT_TIMESTAMP;

  RAISE NOTICE 'Updated tenant_rank_plans to STUDIO_PRO_MAX for tenant_id: %', user_tenant_id;

END $$;
