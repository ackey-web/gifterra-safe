-- 通知タイプの拡張: フォロー通知を追加
-- メール通知と独立した通知設定に対応

-- 既存レコードに followed を追加（デフォルトtrue）
UPDATE user_notification_settings
SET notification_types = jsonb_set(
  notification_types,
  '{followed}',
  'true'::jsonb,
  true
)
WHERE notification_types IS NOT NULL
AND NOT (notification_types ? 'followed');

-- notification_types のデフォルト値を更新
ALTER TABLE user_notification_settings
ALTER COLUMN notification_types
SET DEFAULT '{"jpyc_received": true, "rank_up": true, "gift_received": true, "followed": true}'::jsonb;

-- コメント更新
COMMENT ON COLUMN user_notification_settings.notification_types IS '通知タイプごとのON/OFF設定: jpyc_received(JPYC受信), rank_up(ランクアップ), gift_received(ギフト受信), followed(フォローされた)';
