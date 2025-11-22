-- ユーザーブックマーク機能のテーブル作成
-- 他のユーザーをブックマーク登録し、送金時に簡単に選択できるようにする

CREATE TABLE IF NOT EXISTS user_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address TEXT NOT NULL,           -- ブックマークしたユーザーのウォレットアドレス
  bookmarked_address TEXT NOT NULL,     -- ブックマークされたユーザーのウォレットアドレス
  nickname TEXT,                        -- 任意のニックネーム（例: "田中さん", "会社の同僚"）
  memo TEXT,                            -- メモ欄（任意）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 同じユーザーが同じアドレスを複数回ブックマークできないようにする
  UNIQUE(user_address, bookmarked_address)
);

-- インデックス作成（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_address
  ON user_bookmarks(user_address);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_bookmarked_address
  ON user_bookmarks(bookmarked_address);

-- Row Level Security (RLS) を有効化
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: 自分のブックマークのみ閲覧可能
CREATE POLICY "Users can view their own bookmarks"
  ON user_bookmarks
  FOR SELECT
  USING (true); -- 全員が閲覧可能（後でuser_addressでフィルタリング）

-- RLSポリシー: 自分のブックマークのみ作成可能
CREATE POLICY "Users can create their own bookmarks"
  ON user_bookmarks
  FOR INSERT
  WITH CHECK (true);

-- RLSポリシー: 自分のブックマークのみ更新可能
CREATE POLICY "Users can update their own bookmarks"
  ON user_bookmarks
  FOR UPDATE
  USING (true);

-- RLSポリシー: 自分のブックマークのみ削除可能
CREATE POLICY "Users can delete their own bookmarks"
  ON user_bookmarks
  FOR DELETE
  USING (true);

-- updated_at自動更新のトリガー関数
CREATE OR REPLACE FUNCTION update_user_bookmarks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー設定
CREATE TRIGGER user_bookmarks_updated_at
  BEFORE UPDATE ON user_bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_user_bookmarks_updated_at();

-- コメント追加
COMMENT ON TABLE user_bookmarks IS 'ユーザーが他のユーザーをブックマーク登録するテーブル';
COMMENT ON COLUMN user_bookmarks.user_address IS 'ブックマークを登録したユーザーのウォレットアドレス';
COMMENT ON COLUMN user_bookmarks.bookmarked_address IS 'ブックマークされたユーザーのウォレットアドレス';
COMMENT ON COLUMN user_bookmarks.nickname IS 'ブックマークユーザーに付けた任意のニックネーム';
COMMENT ON COLUMN user_bookmarks.memo IS 'メモ欄（任意）';
