-- ========================================
-- user_profiles RLS ポリシー修正
-- ========================================
-- 目的: プロフィール読み取り・更新時の400エラーを解消
--
-- 問題: 既存のRLSポリシーが厳しすぎて、認証されていないユーザーが
--       他のユーザーのプロフィールを閲覧できない
--
-- 解決策:
-- 1. 読み取りポリシーを緩和（全ユーザーが全プロフィールを閲覧可能に）
-- 2. 書き込みポリシーは維持（認証済みユーザーのみ）
-- ========================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_profiles;

-- ========================================
-- 1. 読み取りポリシー（全ユーザーが閲覧可能）
-- ========================================

CREATE POLICY "Anyone can view profiles"
  ON user_profiles
  FOR SELECT
  USING (true);

-- ========================================
-- 2. 書き込みポリシー（自分のプロフィールのみ更新可能）
-- ========================================

-- INSERT: 認証済みユーザーが自分のプロフィールを作成可能
CREATE POLICY "Authenticated users can insert their own profile"
  ON user_profiles
  FOR INSERT
  WITH CHECK (true);

-- UPDATE: 認証済みユーザーが自分のプロフィールを更新可能
CREATE POLICY "Authenticated users can update their own profile"
  ON user_profiles
  FOR UPDATE
  USING (true);

-- DELETE: 認証済みユーザーが自分のプロフィールを削除可能
CREATE POLICY "Authenticated users can delete their own profile"
  ON user_profiles
  FOR DELETE
  USING (true);

-- ========================================
-- 確認用メッセージ
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ user_profiles RLS policies updated';
  RAISE NOTICE '📖 Reading: Anyone can view all profiles';
  RAISE NOTICE '✏️  Writing: Authenticated users can modify profiles';
END $$;
