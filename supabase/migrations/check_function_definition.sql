-- ===================================================================
-- create_download_token 関数の定義を確認するクエリ
-- ===================================================================
-- このクエリを実行して、関数のデフォルトパラメータが 86400 (24時間) になっているか確認してください
-- もし 900 (15分) のままであれば、マイグレーションが正しく適用されていません

SELECT
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'create_download_token';

-- ===================================================================
-- 実行後の確認ポイント：
-- ===================================================================
-- 1. arguments カラムに「p_ttl_seconds integer DEFAULT 86400」と表示されているか
-- 2. full_definition カラムのコメントに「デフォルト24時間」と表示されているか
--
-- もし「DEFAULT 900」や「デフォルト15分」と表示されていた場合：
-- → 004_update_token_expiration.sql を再度実行してください
