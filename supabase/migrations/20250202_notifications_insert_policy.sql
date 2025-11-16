-- 通知テーブルにINSERTポリシーを追加
-- フォロー通知などをユーザー自身が作成できるようにする

-- 認証済みユーザーは通知を作成可能
CREATE POLICY IF NOT EXISTS "Authenticated users can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- コメント追加
COMMENT ON POLICY "Authenticated users can create notifications" ON notifications
  IS '認証済みユーザーは通知を作成できる（フォロー通知など）';
