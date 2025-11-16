-- 通知テーブルにINSERTポリシーを追加
-- フォロー通知などをユーザー自身が作成できるようにする

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can create notifications" ON notifications;

-- 誰でも通知を作成可能（ウォレット認証のため）
-- 注意: フロントエンドで適切に検証すること
CREATE POLICY "Anyone can create notifications"
  ON notifications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- コメント追加
COMMENT ON POLICY "Anyone can create notifications" ON notifications
  IS 'ウォレット認証を使用しているため、誰でも通知を作成できる（フォロー通知など）';
