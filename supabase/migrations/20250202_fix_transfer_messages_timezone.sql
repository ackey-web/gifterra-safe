-- transfer_messagesテーブルのcreated_atとexpires_atをタイムゾーン対応に変更
-- 既存のデータを保持しつつ、カラムの型を変更
-- PostgreSQLのTIMESTAMPTZ（TIMESTAMP WITH TIME ZONE）は内部的にUTCで保存され、
-- クライアント側で適切なタイムゾーン（日本時間など）に自動変換される

-- created_atをTIMESTAMP WITH TIME ZONEに変更
-- 既存のデータはタイムゾーンなしのTIMESTAMPとしてUTC扱いされていたため、
-- AT TIME ZONE 'UTC'で明示的にUTCタイムゾーンを付与
ALTER TABLE transfer_messages
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- expires_atをTIMESTAMP WITH TIME ZONEに変更
ALTER TABLE transfer_messages
  ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC';

-- デフォルト値を更新（現在時刻をUTCで設定、クライアント側で日本時間に変換される）
ALTER TABLE transfer_messages
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE transfer_messages
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '90 days');

-- コメント
COMMENT ON COLUMN transfer_messages.created_at IS 'メッセージ作成日時（UTC保存、クライアント側で日本時間に自動変換）';
COMMENT ON COLUMN transfer_messages.expires_at IS 'メッセージ有効期限（UTC保存、90日後に自動削除、クライアント側で日本時間に自動変換）';
