-- 匿名送金拒否設定の追加
-- user_profilesテーブルにreject_anonymous_transfersカラムを追加

-- reject_anonymous_transfersカラムを追加
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS reject_anonymous_transfers BOOLEAN DEFAULT false;

-- コメント追加
COMMENT ON COLUMN user_profiles.reject_anonymous_transfers IS 'trueの場合、匿名送金を拒否する。送信者側で警告を表示し送金を制限。';

-- インデックス作成（頻繁に検索される場合の最適化）
CREATE INDEX IF NOT EXISTS idx_user_profiles_reject_anonymous
ON user_profiles(wallet_address, reject_anonymous_transfers)
WHERE reject_anonymous_transfers = true;
