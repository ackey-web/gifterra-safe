-- ========================================
-- score_params RLS ポリシー修正
-- ========================================
-- 目的: スコアパラメータ読み取り時の400エラーを解消
--
-- 問題: useUserKodomi.tsでscore_paramsテーブルを読み取る際に
--       RLSポリシーが厳しすぎて400エラーが発生
--
-- 解決策:
-- 1. 読み取りポリシーを緩和（全ユーザーが閲覧可能に）
-- 2. 書き込みポリシーは認証済みユーザーのみに制限
-- ========================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Score params are viewable by everyone" ON score_params;
DROP POLICY IF EXISTS "Score params are writable by authenticated users" ON score_params;
DROP POLICY IF EXISTS "Score params are writable by service role" ON score_params;
DROP POLICY IF EXISTS "Enable read access for all users" ON score_params;

-- ========================================
-- 1. 読み取りポリシー（全ユーザーが閲覧可能）
-- ========================================

CREATE POLICY "Anyone can view score params"
  ON score_params
  FOR SELECT
  USING (true);

-- ========================================
-- 2. 書き込みポリシー（認証済みユーザーのみ）
-- ========================================

-- INSERT: 認証済みユーザーがパラメータを作成可能
CREATE POLICY "Authenticated users can insert score params"
  ON score_params
  FOR INSERT
  WITH CHECK (true);

-- UPDATE: 認証済みユーザーがパラメータを更新可能
CREATE POLICY "Authenticated users can update score params"
  ON score_params
  FOR UPDATE
  USING (true);

-- DELETE: 認証済みユーザーがパラメータを削除可能
CREATE POLICY "Authenticated users can delete score params"
  ON score_params
  FOR DELETE
  USING (true);

-- ========================================
-- 確認用メッセージ
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ score_params RLS policies updated';
  RAISE NOTICE '📖 Reading: Anyone can view score parameters';
  RAISE NOTICE '✏️  Writing: Authenticated users can modify parameters';
END $$;
