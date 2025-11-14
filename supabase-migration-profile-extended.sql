-- プロフィール拡張機能のためのマイグレーション
-- user_profiles テーブルに新規カラムを追加

-- 1. Webサイト/プロフィールリンク
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS website_url TEXT;

-- 2. カスタムリンク（JSONB配列）
-- 構造: [{"label": "X", "url": "https://x.com/..."}, ...]
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS custom_links JSONB DEFAULT '[]'::jsonb;

-- 3. ロール（TEXT配列）
-- 値: CREATOR, SHOP, EVENT, COMMUNITY, PERFORMER, PROJECT_OWNER, METAVERSE, DEVELOPER, FAN
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}'::text[];

-- 4. 所在地
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS location TEXT;

-- 5. カバー画像URL
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- インデックス追加（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_user_profiles_roles ON user_profiles USING GIN (roles);

-- コメント追加
COMMENT ON COLUMN user_profiles.website_url IS 'メインWebサイト/プロフィールリンク（https://...）';
COMMENT ON COLUMN user_profiles.custom_links IS 'カスタムリンク配列（最大3件推奨）: [{"label": "X", "url": "https://..."}, ...]';
COMMENT ON COLUMN user_profiles.roles IS 'ユーザーロール配列（複数選択可）';
COMMENT ON COLUMN user_profiles.location IS '所在地（20文字以内推奨）';
COMMENT ON COLUMN user_profiles.cover_image_url IS 'カバー画像URL（16:9推奨）';
