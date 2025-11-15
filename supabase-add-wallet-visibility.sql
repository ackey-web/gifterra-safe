-- ウォレットアドレスの公開/非公開設定カラムを追加
-- 実行方法: Supabase Dashboard → SQL Editor → このSQLを貼り付けて実行

-- user_profiles テーブルに show_wallet_address カラムを追加
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS show_wallet_address BOOLEAN DEFAULT true;

-- 既存のレコードはデフォルトで公開に設定
UPDATE user_profiles
SET show_wallet_address = true
WHERE show_wallet_address IS NULL;

-- コメントを追加
COMMENT ON COLUMN user_profiles.show_wallet_address IS 'ウォレットアドレスをプロフィールページで公開するかどうか（true: 公開, false: 非公開）';

-- 確認用クエリ
SELECT wallet_address, display_name, show_wallet_address
FROM user_profiles
LIMIT 10;
