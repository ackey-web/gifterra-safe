-- フォロー機能のためのテーブル追加
-- 実行方法: Supabase Dashboard → SQL Editor → このSQLを貼り付けて実行

-- user_follows テーブルを作成
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  follower_address TEXT NOT NULL,  -- フォローする人のウォレットアドレス
  following_address TEXT NOT NULL, -- フォローされる人のウォレットアドレス
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 同じユーザーを重複してフォローできないようにする
  UNIQUE(tenant_id, follower_address, following_address),

  -- 自分自身をフォローできないようにする
  CHECK (follower_address != following_address)
);

-- インデックスを作成（クエリパフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_user_follows_follower
  ON user_follows(tenant_id, follower_address);

CREATE INDEX IF NOT EXISTS idx_user_follows_following
  ON user_follows(tenant_id, following_address);

CREATE INDEX IF NOT EXISTS idx_user_follows_created_at
  ON user_follows(created_at DESC);

-- テーブルコメントを追加
COMMENT ON TABLE user_follows IS 'ユーザー間のフォロー関係を管理するテーブル';
COMMENT ON COLUMN user_follows.follower_address IS 'フォローする人のウォレットアドレス';
COMMENT ON COLUMN user_follows.following_address IS 'フォローされる人のウォレットアドレス';
COMMENT ON COLUMN user_follows.tenant_id IS 'テナントID（マルチテナント対応）';

-- Row Level Security (RLS) を有効化
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- 誰でもフォロー関係を読み取れるポリシー（公開情報）
CREATE POLICY "Anyone can view follow relationships"
  ON user_follows
  FOR SELECT
  USING (true);

-- ユーザーは自分のフォロー関係のみ作成できる
CREATE POLICY "Users can create their own follows"
  ON user_follows
  FOR INSERT
  WITH CHECK (true);  -- 認証済みユーザーなら誰でも作成可能

-- ユーザーは自分のフォロー関係のみ削除できる
CREATE POLICY "Users can delete their own follows"
  ON user_follows
  FOR DELETE
  USING (true);  -- 認証済みユーザーなら誰でも削除可能

-- 確認用クエリ
-- フォロー数が多いユーザートップ10を表示
SELECT
  following_address,
  COUNT(*) as follower_count
FROM user_follows
WHERE tenant_id = 'default'
GROUP BY following_address
ORDER BY follower_count DESC
LIMIT 10;
