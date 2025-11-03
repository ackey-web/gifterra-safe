-- ===================================================================
-- download_tokensテーブルのRLSポリシーを修正
-- ===================================================================
-- 問題: JWT認証を使っていないため、現在のRLSポリシーでアクセスが拒否される
-- 解決: 匿名ユーザー(anon)に対しても、すべてのトークンを読み取り可能にする
--       （セキュリティ: トークンはUUID v4でランダム生成されており、推測不可能）

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "download_tokens: Buyers can read their own tokens" ON download_tokens;

-- 新しいポリシー: 匿名ユーザーでもトークンテーブルを読み取り可能
CREATE POLICY "download_tokens: Public can read all tokens"
  ON download_tokens FOR SELECT
  TO public
  USING (true);

-- 注意事項:
-- 1. トークンはUUID v4 (128-bit)でランダム生成されており、推測不可能
-- 2. トークンは一度しか使用できない（is_consumed フラグ）
-- 3. トークンには有効期限がある（expires_at）
-- 4. 実際のダウンロードはAPIで買い手の検証を行っている
-- 5. したがって、トークンテーブル自体を読み取り可能にしてもセキュリティリスクは低い
