-- tenant_applications.tenant_id にユニーク制約を追加
-- 外部キー制約のために必要

-- 既存のユニーク制約を確認して、なければ追加
DO $$
BEGIN
  -- tenant_idカラムにユニーク制約がない場合のみ追加
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'tenant_applications'
      AND kcu.column_name = 'tenant_id'
      AND tc.constraint_type = 'UNIQUE'
  ) THEN
    -- NULLを許容するユニーク制約を追加
    -- tenant_idがNULLでないレコードのみユニークであることを保証
    ALTER TABLE tenant_applications
    ADD CONSTRAINT unique_tenant_id UNIQUE (tenant_id);

    RAISE NOTICE 'tenant_applications.tenant_id にユニーク制約を追加しました';
  ELSE
    RAISE NOTICE 'tenant_applications.tenant_id には既にユニーク制約があります';
  END IF;
END $$;
