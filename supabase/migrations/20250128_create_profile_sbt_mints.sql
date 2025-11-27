-- プロフィールSBTミント記録テーブル
-- ユーザーが各テナントで獲得したSBTランクを記録し、重複ミントを防止

CREATE TABLE IF NOT EXISTS profile_sbt_mints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL, -- テナントID
  user_address TEXT NOT NULL, -- ユーザーのウォレットアドレス（小文字正規化）
  rank_level INTEGER NOT NULL, -- ミントされたSBTランク (1-5)
  kodomi_at_mint INTEGER NOT NULL, -- ミント時のkodomi値
  minted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tx_hash TEXT, -- ミントトランザクションハッシュ（オプション）

  -- 複合ユニーク制約：同じユーザーが同じテナントで同じランクを重複ミントできない
  UNIQUE(tenant_id, user_address, rank_level)
);

-- インデックス作成（検索高速化）
CREATE INDEX IF NOT EXISTS idx_profile_sbt_mints_user ON profile_sbt_mints(user_address);
CREATE INDEX IF NOT EXISTS idx_profile_sbt_mints_tenant ON profile_sbt_mints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profile_sbt_mints_tenant_user ON profile_sbt_mints(tenant_id, user_address);

-- RLS (Row Level Security) 設定
ALTER TABLE profile_sbt_mints ENABLE ROW LEVEL SECURITY;

-- ポリシー: 全ユーザーが読み取り可能
CREATE POLICY "Anyone can view profile_sbt_mints"
  ON profile_sbt_mints
  FOR SELECT
  USING (true);

-- ポリシー: 認証済みユーザーのみ書き込み可能
CREATE POLICY "Authenticated users can insert profile_sbt_mints"
  ON profile_sbt_mints
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE profile_sbt_mints IS 'プロフィールSBTミント記録テーブル - kodomi値による自動ミント管理';
COMMENT ON COLUMN profile_sbt_mints.tenant_id IS 'テナントID（UUID形式）';
COMMENT ON COLUMN profile_sbt_mints.user_address IS 'ユーザーウォレットアドレス（小文字）';
COMMENT ON COLUMN profile_sbt_mints.rank_level IS 'ミントされたランク（1-5）';
COMMENT ON COLUMN profile_sbt_mints.kodomi_at_mint IS 'ミント時のkodomi値';
COMMENT ON COLUMN profile_sbt_mints.tx_hash IS 'ブロックチェーントランザクションハッシュ';
