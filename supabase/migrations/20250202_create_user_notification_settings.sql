-- ユーザー通知設定テーブル
-- メール通知のON/OFF、メールアドレス、通知タイプごとの設定を管理

CREATE TABLE IF NOT EXISTS user_notification_settings (
  user_address text PRIMARY KEY,
  email_notifications_enabled boolean DEFAULT false,
  email_address text,
  notification_types jsonb DEFAULT '{"jpyc_received": true, "rank_up": true, "gift_received": true}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 更新時に updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_user_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_notification_settings_updated_at
  BEFORE UPDATE ON user_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_notification_settings_updated_at();

-- RLS (Row Level Security) ポリシー
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の設定のみ読み取り・更新可能
CREATE POLICY "Users can read their own settings"
  ON user_notification_settings
  FOR SELECT
  USING (user_address = lower(auth.jwt()->>'user_address'));

CREATE POLICY "Users can insert their own settings"
  ON user_notification_settings
  FOR INSERT
  WITH CHECK (user_address = lower(auth.jwt()->>'user_address'));

CREATE POLICY "Users can update their own settings"
  ON user_notification_settings
  FOR UPDATE
  USING (user_address = lower(auth.jwt()->>'user_address'));

-- Edge Function からの読み取り・書き込みを許可（service_role使用時）
CREATE POLICY "Service role can read all settings"
  ON user_notification_settings
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can update all settings"
  ON user_notification_settings
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- コメント
COMMENT ON TABLE user_notification_settings IS 'ユーザーごとの通知設定（メール通知ON/OFF、通知タイプなど）';
COMMENT ON COLUMN user_notification_settings.user_address IS 'ユーザーのウォレットアドレス（小文字）';
COMMENT ON COLUMN user_notification_settings.email_notifications_enabled IS 'メール通知の有効/無効';
COMMENT ON COLUMN user_notification_settings.email_address IS 'メール送信先アドレス';
COMMENT ON COLUMN user_notification_settings.notification_types IS '通知タイプごとのON/OFF設定（JSONB）';
