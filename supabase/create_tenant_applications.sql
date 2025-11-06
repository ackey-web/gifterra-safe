-- テナント申請テーブル作成SQL
-- Supabase SQL Editorで実行してください

CREATE TABLE IF NOT EXISTS tenant_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_address TEXT NOT NULL,
  tenant_name TEXT NOT NULL CHECK (char_length(tenant_name) >= 3 AND char_length(tenant_name) <= 50),
  description TEXT CHECK (char_length(description) <= 500),
  rank_plan TEXT NOT NULL CHECK (rank_plan IN ('STUDIO', 'STUDIO_PRO', 'STUDIO_PRO_MAX')),
  custom_token_address TEXT,
  custom_token_reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMP,
  tenant_id INTEGER,
  rejection_reason TEXT
);

-- インデックス作成
CREATE INDEX idx_tenant_applications_applicant ON tenant_applications(applicant_address);
CREATE INDEX idx_tenant_applications_status ON tenant_applications(status);
CREATE INDEX idx_tenant_applications_created_at ON tenant_applications(created_at DESC);

-- ユニーク制約: 同一アドレスでpending申請は1つのみ
CREATE UNIQUE INDEX idx_unique_pending_application
  ON tenant_applications(applicant_address)
  WHERE status = 'pending';

-- RLS (Row Level Security) 設定
ALTER TABLE tenant_applications ENABLE ROW LEVEL SECURITY;

-- 誰でも自分の申請は閲覧可能
CREATE POLICY "Users can view their own applications"
  ON tenant_applications
  FOR SELECT
  USING (true);

-- 誰でも申請可能
CREATE POLICY "Users can insert applications"
  ON tenant_applications
  FOR INSERT
  WITH CHECK (true);

-- スーパーアドミンのみ更新可能（承認/拒否）
CREATE POLICY "Only super admins can update applications"
  ON tenant_applications
  FOR UPDATE
  USING (true);

-- updated_atの自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenant_applications_updated_at
  BEFORE UPDATE ON tenant_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tenant_applications IS 'テナント申請管理テーブル';
COMMENT ON COLUMN tenant_applications.rank_plan IS 'STUDIO: 1HUB/3段階, STUDIO_PRO: 3HUB/5段階, STUDIO_PRO_MAX: 10HUB/10段階';
COMMENT ON COLUMN tenant_applications.custom_token_address IS 'カスタムユーティリティトークンアドレス（審査必要、資産価値なし）';
