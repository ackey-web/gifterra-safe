-- tenant_rank_plansの外部キー制約を修正
-- 問題: fk_tenant_rank_plans_tenant_id が tenant_applications.tenant_id を参照しているが、
--       tenant_idにユニーク制約がない、またはNULLのため参照できない

DO $$
BEGIN
  -- 1. 既存の外部キー制約を削除
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tenant_rank_plans_tenant_id'
      AND table_name = 'tenant_rank_plans'
  ) THEN
    ALTER TABLE tenant_rank_plans
    DROP CONSTRAINT fk_tenant_rank_plans_tenant_id;

    RAISE NOTICE '既存の外部キー制約を削除しました: fk_tenant_rank_plans_tenant_id';
  END IF;

  -- 2. tenant_applications.tenant_id にユニーク制約を追加（まだない場合）
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'tenant_applications'
      AND kcu.column_name = 'tenant_id'
      AND tc.constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE tenant_applications
    ADD CONSTRAINT unique_tenant_id UNIQUE (tenant_id);

    RAISE NOTICE 'tenant_applications.tenant_id にユニーク制約を追加しました';
  ELSE
    RAISE NOTICE 'tenant_applications.tenant_id には既にユニーク制約があります';
  END IF;

  -- 3. 外部キー制約を再作成
  ALTER TABLE tenant_rank_plans
  ADD CONSTRAINT fk_tenant_rank_plans_tenant_id
  FOREIGN KEY (tenant_id)
  REFERENCES tenant_applications (tenant_id)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

  RAISE NOTICE '外部キー制約を再作成しました: fk_tenant_rank_plans_tenant_id';
END $$;
