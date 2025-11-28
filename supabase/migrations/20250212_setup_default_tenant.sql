-- デフォルトテナント (GIFTERRA Official) のセットアップ
-- 実行日: 2025-02-12
-- 注意: tenant_id は UUID 型です

-- デフォルトテナント用の固定UUID
-- '00000000-0000-0000-0000-000000000001' を使用
DO $$
DECLARE
  default_tenant_uuid UUID := '00000000-0000-0000-0000-000000000001'::uuid;
  updated_rows INTEGER;
  existing_tenant_id UUID;
BEGIN
  -- 0. 既存のtenant_idを確認
  SELECT tenant_id INTO existing_tenant_id
  FROM tenant_applications
  WHERE applicant_address = '0x66f1274ad5d042b7571c2efa943370dbcd3459ab'
    AND status = 'approved';

  IF existing_tenant_id IS NOT NULL THEN
    RAISE NOTICE '既にtenant_idが設定されています: %', existing_tenant_id;
    -- 既存のtenant_idを使用
    default_tenant_uuid := existing_tenant_id;
  ELSE
    -- 1. tenant_applicationsテーブルの該当レコードにtenant_idを設定
    UPDATE tenant_applications
    SET tenant_id = default_tenant_uuid
    WHERE applicant_address = '0x66f1274ad5d042b7571c2efa943370dbcd3459ab'
      AND status = 'approved';

    GET DIAGNOSTICS updated_rows = ROW_COUNT;

    IF updated_rows = 0 THEN
      RAISE EXCEPTION 'テナント申請レコードが見つかりません。先にregister-default-tenant.tsを実行してください。';
    END IF;

    RAISE NOTICE 'tenant_applicationsテーブル更新完了: % 行更新', updated_rows;
  END IF;

  -- 2. tenant_rank_plansテーブルにSTUDIO_PRO_MAXプランを追加
  -- 既存レコードがある場合は更新、ない場合は挿入
  INSERT INTO tenant_rank_plans (
    tenant_id,
    rank_plan,
    is_active,
    subscription_start_date,
    updated_by
  )
  VALUES (
    default_tenant_uuid,
    'STUDIO_PRO_MAX',
    true,
    NOW(),
    '0x66f1274ad5d042b7571c2efa943370dbcd3459ab'
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    rank_plan = 'STUDIO_PRO_MAX',
    is_active = true,
    updated_by = '0x66f1274ad5d042b7571c2efa943370dbcd3459ab',
    updated_at = NOW();

  RAISE NOTICE 'デフォルトテナント設定完了: tenant_id = %', default_tenant_uuid;
END $$;

-- 確認用クエリ
SELECT
  applicant_address,
  tenant_name,
  status,
  tenant_id,
  rank_plan
FROM tenant_applications
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid;

SELECT
  tenant_id,
  rank_plan,
  is_active,
  subscription_start_date
FROM tenant_rank_plans
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid;
