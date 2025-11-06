-- カスタムトークン承認フラグをtenant_rank_plansテーブルに追加
-- Supabase SQL Editorで実行してください

-- tenant_rank_plansテーブルにカスタムトークン関連カラムを追加
ALTER TABLE tenant_rank_plans
ADD COLUMN IF NOT EXISTS custom_token_address TEXT,
ADD COLUMN IF NOT EXISTS custom_token_approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_token_approved_by TEXT,
ADD COLUMN IF NOT EXISTS custom_token_approved_at TIMESTAMP;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_tenant_rank_plans_custom_token_approved
  ON tenant_rank_plans(custom_token_approved);

-- コメント追加
COMMENT ON COLUMN tenant_rank_plans.custom_token_address IS 'カスタムトークンのコントラクトアドレス（PRO MAX専用）';
COMMENT ON COLUMN tenant_rank_plans.custom_token_approved IS 'カスタムトークンがスーパーアドミンに承認されたか';
COMMENT ON COLUMN tenant_rank_plans.custom_token_approved_by IS '承認したスーパーアドミンのアドレス';
COMMENT ON COLUMN tenant_rank_plans.custom_token_approved_at IS '承認日時';
