-- 匿名送金機能の追加
-- transfer_messagesテーブルにis_anonymousカラムを追加

-- is_anonymousカラムを追加
ALTER TABLE transfer_messages
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;

-- コメント追加
COMMENT ON COLUMN transfer_messages.is_anonymous IS 'trueの場合、受信者側で送信者情報を匿名化して表示する';

-- 匿名送金メッセージ検索用のインデックス作成
CREATE INDEX IF NOT EXISTS idx_transfer_messages_anonymous
ON transfer_messages(to_address, is_anonymous, created_at DESC)
WHERE is_anonymous = true;

-- 匿名送金の統計用インデックス
CREATE INDEX IF NOT EXISTS idx_transfer_messages_anonymous_stats
ON transfer_messages(tenant_id, is_anonymous, created_at DESC)
WHERE is_anonymous = true;
