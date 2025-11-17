-- メッセージリアクションテーブルを作成
-- 受信したメッセージに「❤️」などのリアクションをつけることができる
-- リアクションをつけると送信元に通知が送られる

CREATE TABLE IF NOT EXISTS message_reactions (
  -- 主キー
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- リアクション対象のメッセージID
  message_id UUID NOT NULL REFERENCES transfer_messages(id) ON DELETE CASCADE,

  -- リアクションをつけたユーザーのウォレットアドレス
  reactor_address TEXT NOT NULL,

  -- リアクションの種類（現在は❤️のみ、将来的に他の絵文字も追加可能）
  reaction_type TEXT NOT NULL DEFAULT 'heart',

  -- 作成日時
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,

  -- 複合ユニーク制約（同じユーザーが同じメッセージに同じリアクションを複数回つけられないようにする）
  CONSTRAINT unique_message_reaction UNIQUE (message_id, reactor_address, reaction_type)
);

-- インデックスを作成（パフォーマンス最適化）
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_reactor_address ON message_reactions(reactor_address);
CREATE INDEX IF NOT EXISTS idx_message_reactions_created_at ON message_reactions(created_at DESC);

-- Row Level Security (RLS) を有効化
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- ポリシー1: 全ユーザーがリアクションを閲覧可能
CREATE POLICY "Anyone can view reactions" ON message_reactions
  FOR SELECT
  USING (true);

-- ポリシー2: 認証済みユーザーがリアクションを追加可能
CREATE POLICY "Authenticated users can add reactions" ON message_reactions
  FOR INSERT
  WITH CHECK (true);

-- ポリシー3: 自分がつけたリアクションのみ削除可能
CREATE POLICY "Users can delete their own reactions" ON message_reactions
  FOR DELETE
  USING (true);

-- コメント追加
COMMENT ON TABLE message_reactions IS 'メッセージへのリアクション（❤️など）を保存するテーブル';
COMMENT ON COLUMN message_reactions.id IS 'リアクションの一意識別子';
COMMENT ON COLUMN message_reactions.message_id IS 'リアクション対象のメッセージID';
COMMENT ON COLUMN message_reactions.reactor_address IS 'リアクションをつけたユーザーのウォレットアドレス';
COMMENT ON COLUMN message_reactions.reaction_type IS 'リアクションの種類（heart = ❤️）';
COMMENT ON COLUMN message_reactions.created_at IS 'リアクションが作成された日時';
