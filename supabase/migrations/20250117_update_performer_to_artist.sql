-- ロール値の修正: PERFORMER → ARTIST
-- 既存のuser_profilesテーブルのrolesカラムで「PERFORMER」を「ARTIST」に置換

UPDATE user_profiles
SET roles = array_replace(roles, 'PERFORMER', 'ARTIST')
WHERE 'PERFORMER' = ANY(roles);

-- コメント更新
COMMENT ON COLUMN user_profiles.roles IS 'ユーザーロール配列（複数選択可）: CREATOR, SHOP, EVENT, COMMUNITY, ARTIST, PROJECT_OWNER, METAVERSE, DEVELOPER, FAN';
