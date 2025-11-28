-- デフォルトテナントアドレスを 0x66f1274ad5d042b7571c2efa943370dbcd3459ab に変更
-- 旧アドレス (0x0174477a1fceb9de25289cd1ca48b6998c9cd7fc) のデータをクリーンアップ

DO $$
DECLARE
  default_tenant_uuid UUID := '00000000-0000-0000-0000-000000000001'::uuid;
  new_address TEXT := '0x66f1274ad5d042b7571c2efa943370dbcd3459ab';
  old_address TEXT := '0x0174477a1fceb9de25289cd1ca48b6998c9cd7fc';
  old_tenant_id UUID;
BEGIN
  -- 1. 旧アドレスの tenant_id を取得
  SELECT tenant_id INTO old_tenant_id
  FROM tenant_applications
  WHERE applicant_address = old_address
    AND status = 'approved';

  -- 2. 旧アドレスのデータをクリーンアップ
  IF old_tenant_id IS NOT NULL THEN
    -- tenant_rank_plans から旧テナントのプランを削除
    DELETE FROM tenant_rank_plans
    WHERE tenant_id = old_tenant_id;

    RAISE NOTICE '旧テナント (%) のランクプランを削除しました', old_address;

    -- tenant_applications の tenant_id を NULL に戻す
    UPDATE tenant_applications
    SET tenant_id = NULL
    WHERE applicant_address = old_address;

    RAISE NOTICE '旧テナント (%) の tenant_id を NULL に設定しました', old_address;
  END IF;

  -- 3. 新アドレスの tenant_id を更新
  UPDATE tenant_applications
  SET tenant_id = default_tenant_uuid,
      tenant_name = 'GIFTERRA Official'
  WHERE applicant_address = new_address
    AND status = 'approved';

  RAISE NOTICE '新テナント (%) の tenant_id を % に設定しました', new_address, default_tenant_uuid;

  -- 4. tenant_rank_plans にプランを追加/更新
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
    new_address
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    rank_plan = 'STUDIO_PRO_MAX',
    is_active = true,
    updated_by = EXCLUDED.updated_by,
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
