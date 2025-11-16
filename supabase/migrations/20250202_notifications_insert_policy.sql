-- 通知テーブルにINSERTポリシーを追加
-- フォロー通知などをユーザー自身が作成できるようにする

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;

-- 認証済みユーザーは通知を作成可能
CREATE POLICY "Authenticated users can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- コメント追加
COMMENT ON POLICY "Authenticated users can create notifications" ON notifications
  IS '認証済みユーザーは通知を作成できる（フォロー通知など）';
