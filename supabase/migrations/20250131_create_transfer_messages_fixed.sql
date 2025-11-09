-- 送金メッセージテーブルの作成
-- 送金時にプロフィール情報とメッセージを付与できる機能

CREATE TABLE IF NOT EXISTS transfer_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL, -- 'JPYC' | 'tNHT'
  amount TEXT NOT NULL,
  message TEXT, -- 送信者からのメッセージ（任意）
  sender_profile JSONB, -- { name, bio, icon_url } などのプロフィール情報
  tx_hash TEXT, -- ブロックチェーントランザクションハッシュ
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '90 days'), -- 90日後に自動削除
  is_read BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE -- アーカイブフラグ（削除対象外）
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_transfer_to ON transfer_messages(to_address, tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_from ON transfer_messages(from_address, tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_expires ON transfer_messages(expires_at) WHERE is_archived = FALSE;

-- RLS (Row Level Security) ポリシー
ALTER TABLE transfer_messages ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Users can view their own transfer messages" ON transfer_messages;
DROP POLICY IF EXISTS "Users can insert transfer messages" ON transfer_messages;
DROP POLICY IF EXISTS "Users can update their received messages" ON transfer_messages;

-- ユーザーは自分宛てのメッセージと自分が送ったメッセージを閲覧可能
CREATE POLICY "Users can view their own transfer messages"
  ON transfer_messages
  FOR SELECT
  USING (true); -- 認証なしで全て閲覧可能（テナントIDでフィルタリングはアプリ側で行う）

-- ユーザーは送金メッセージを作成可能
CREATE POLICY "Users can insert transfer messages"
  ON transfer_messages
  FOR INSERT
  WITH CHECK (true); -- 誰でも挿入可能

-- ユーザーは自分宛てのメッセージの既読状態やアーカイブ状態を更新可能
CREATE POLICY "Users can update their received messages"
  ON transfer_messages
  FOR UPDATE
  USING (true); -- 誰でも更新可能

-- 90日以上前の非アーカイブメッセージを自動削除する関数
CREATE OR REPLACE FUNCTION delete_expired_transfer_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM transfer_messages
  WHERE expires_at < NOW()
    AND is_archived = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- pg_cron拡張機能を有効化（既に有効な場合はスキップされます）
-- 注意: 無料プランでは利用できない可能性があります
DO $$
BEGIN
  -- pg_cron拡張が利用可能かチェック
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    -- 既存のジョブを削除（存在する場合）
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'delete-expired-transfer-messages';

    -- 毎日午前3時に期限切れメッセージを削除するジョブを登録
    PERFORM cron.schedule(
      'delete-expired-transfer-messages',
      '0 3 * * *', -- 毎日午前3時
      'SELECT delete_expired_transfer_messages();'
    );
  END IF;
END $$;

-- コメント
COMMENT ON TABLE transfer_messages IS '送金時のメッセージとプロフィール情報を保存するテーブル';
COMMENT ON COLUMN transfer_messages.expires_at IS '90日後に自動削除される期限（アーカイブされていない場合）';
COMMENT ON COLUMN transfer_messages.is_archived IS 'trueの場合、期限が過ぎても削除されない';
COMMENT ON COLUMN transfer_messages.sender_profile IS 'JSONBフィールド: { name, bio, icon_url } など';
