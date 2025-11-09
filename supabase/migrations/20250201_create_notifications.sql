-- 通知システム用テーブル
-- ユーザーへの通知を管理（JPYC受信、チップ受信、テナント申請ステータス変更など）

-- notifications テーブル作成
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address text NOT NULL, -- 通知を受け取るユーザーのウォレットアドレス（小文字）
  type text NOT NULL, -- 通知タイプ: 'jpyc_received', 'tip_received', 'tenant_status_changed'
  title text NOT NULL, -- 通知タイトル
  message text NOT NULL, -- 通知メッセージ
  amount text, -- 金額（JPYC受信、チップの場合）
  token_symbol text, -- トークンシンボル（JPYC, USDC等）
  from_address text, -- 送信元アドレス（小文字）
  tx_hash text, -- トランザクションハッシュ
  metadata jsonb, -- その他のメタデータ（柔軟に拡張可能）
  is_read boolean DEFAULT false, -- 既読フラグ
  created_at timestamp with time zone DEFAULT now(),
  read_at timestamp with time zone -- 既読日時
);

-- インデックス作成（パフォーマンス最適化）
CREATE INDEX IF NOT EXISTS idx_notifications_user_address ON notifications(user_address);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_address, is_read) WHERE is_read = false;

-- RLS（Row Level Security）ポリシー設定
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の通知のみ閲覧可能
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (LOWER(user_address) = LOWER(auth.jwt() ->> 'wallet_address'));

-- ユーザーは自分の通知を既読にできる
CREATE POLICY "Users can mark their own notifications as read"
  ON notifications
  FOR UPDATE
  USING (LOWER(user_address) = LOWER(auth.jwt() ->> 'wallet_address'))
  WITH CHECK (LOWER(user_address) = LOWER(auth.jwt() ->> 'wallet_address'));

-- システム（Edge Function）は全ユーザーの通知を作成可能
-- 注意: Edge FunctionはSERVICE_ROLE_KEYを使用するため、RLSを無視できる

-- コメント追加
COMMENT ON TABLE notifications IS 'ユーザーへの通知を管理するテーブル';
COMMENT ON COLUMN notifications.user_address IS '通知を受け取るユーザーのウォレットアドレス（小文字）';
COMMENT ON COLUMN notifications.type IS '通知タイプ: jpyc_received, tip_received, tenant_status_changed';
COMMENT ON COLUMN notifications.title IS '通知タイトル';
COMMENT ON COLUMN notifications.message IS '通知メッセージ';
COMMENT ON COLUMN notifications.amount IS '金額（JPYC受信、チップの場合）';
COMMENT ON COLUMN notifications.token_symbol IS 'トークンシンボル（JPYC, USDC等）';
COMMENT ON COLUMN notifications.from_address IS '送信元アドレス（小文字）';
COMMENT ON COLUMN notifications.tx_hash IS 'トランザクションハッシュ';
COMMENT ON COLUMN notifications.metadata IS 'その他のメタデータ（柔軟に拡張可能）';
COMMENT ON COLUMN notifications.is_read IS '既読フラグ';
COMMENT ON COLUMN notifications.created_at IS '通知作成日時';
COMMENT ON COLUMN notifications.read_at IS '既読日時';
