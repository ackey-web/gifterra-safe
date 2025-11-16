-- ログイン履歴テーブルの作成
CREATE TABLE IF NOT EXISTS user_login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  wallet_address TEXT NOT NULL,
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX idx_login_history_wallet ON user_login_history(wallet_address, tenant_id);
CREATE INDEX idx_login_history_login_at ON user_login_history(login_at DESC);

-- RLSポリシーの設定
ALTER TABLE user_login_history ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のログイン履歴のみ閲覧可能
CREATE POLICY "Users can view their own login history"
  ON user_login_history
  FOR SELECT
  USING (wallet_address = lower(auth.jwt() ->> 'sub'));

-- user_profilesテーブルに退会関連カラムを追加
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 退会済みユーザーを除外するビューを作成（オプション）
CREATE OR REPLACE VIEW active_user_profiles AS
SELECT * FROM user_profiles
WHERE is_deleted = FALSE OR is_deleted IS NULL;

-- コメント追加
COMMENT ON TABLE user_login_history IS 'ユーザーのログイン履歴を記録';
COMMENT ON COLUMN user_profiles.is_deleted IS '退会フラグ（true=退会済み）';
COMMENT ON COLUMN user_profiles.deleted_at IS '退会日時';
