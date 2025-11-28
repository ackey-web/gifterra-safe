-- デフォルトテナントアドレスを 0xfcea8435dcbba7f3b1da01e8ea3f4af234a20bcb に変更
-- 旧デフォルトテナント (0x0174477a1fceb9de25289cd1ca48b6998c9cd7fc) のデータをクリーンアップ
-- 0x66f1274ad5d042b7571c2efa943370dbcd3459ab は ELEVEN BASS LAB. として保持

DO $$
DECLARE
  default_tenant_uuid UUID := '00000000-0000-0000-0000-000000000001'::uuid;
  new_default_address TEXT := '0xfcea8435dcbba7f3b1da01e8ea3f4af234a20bcb';
  eleven_bass_address TEXT := '0x66f1274ad5d042b7571c2efa943370dbcd3459ab';
  old_address TEXT := '0x0174477a1fceb9de25289cd1ca48b6998c9cd7fc';
  old_tenant_id UUID;
  eleven_bass_tenant_id UUID;
BEGIN
  -- 1. 旧アドレスの tenant_id を取得
  SELECT tenant_id INTO old_tenant_id
  FROM tenant_applications
  WHERE applicant_address = old_address
    AND status = 'approved';

  -- 2. ELEVEN BASS LAB. の tenant_id を取得して保持
  SELECT tenant_id INTO eleven_bass_tenant_id
  FROM tenant_applications
  WHERE applicant_address = eleven_bass_address
    AND status = 'approved';

  -- 3. ELEVEN BASS LAB. のテナント名を元に戻す（もし変更されていたら）
  IF eleven_bass_tenant_id IS NOT NULL THEN
    UPDATE tenant_applications
    SET tenant_name = 'ELEVEN BASS LAB.'
    WHERE applicant_address = eleven_bass_address
      AND status = 'approved';

    RAISE NOTICE 'ELEVEN BASS LAB. (%) のテナント名を復元しました', eleven_bass_address;
  END IF;

  -- 4. 旧デフォルトテナントのデータをクリーンアップ
  IF old_tenant_id IS NOT NULL THEN
    -- tenant_rank_plans から旧テナントのプランを削除
    DELETE FROM tenant_rank_plans
    WHERE tenant_id = old_tenant_id;

    RAISE NOTICE '旧デフォルトテナント (%) のランクプランを削除しました', old_address;

    -- tenant_applications の tenant_id を NULL に戻す
    UPDATE tenant_applications
    SET tenant_id = NULL
    WHERE applicant_address = old_address;

    RAISE NOTICE '旧デフォルトテナント (%) の tenant_id を NULL に設定しました', old_address;
  END IF;

  -- 5. 新デフォルトテナントの tenant_id を更新
  UPDATE tenant_applications
  SET tenant_id = default_tenant_uuid,
      tenant_name = 'GIFTERRA Official'
  WHERE applicant_address = new_default_address
    AND status = 'approved';

  RAISE NOTICE '新デフォルトテナント (%) の tenant_id を % に設定しました', new_default_address, default_tenant_uuid;

  -- 6. tenant_rank_plans にプランを追加/更新
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
    new_default_address
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
