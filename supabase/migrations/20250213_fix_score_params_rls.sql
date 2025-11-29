-- ========================================
-- スコアパラメータのRLSポリシー修正
-- ========================================
-- 目的: 管理画面からのパラメータ保存を許可する

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Score params are writable by service role" ON score_params;

-- 新しいポリシーを作成（認証済みユーザーに書き込み権限を付与）
-- 注意: 実際の運用では、特定の管理者ロールのみに制限することを推奨
CREATE POLICY "Score params are writable by authenticated users"
  ON score_params FOR ALL
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 確認用メッセージ
DO $$
BEGIN
  RAISE NOTICE '✅ Score params RLS policy updated';
  RAISE NOTICE '⚠️  WARNING: All authenticated users can now write to score_params';
  RAISE NOTICE '📝 TODO: Add admin role check for production use';
END $$;
