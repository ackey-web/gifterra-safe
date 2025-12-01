-- ========================================
-- user_profiles重複UNIQUE制約を削除
-- ========================================
-- 目的: upsert時の409 Conflictエラーを解消
--
-- 問題: テーブルに2つのUNIQUE制約が存在
--   1. user_profiles_wallet_address_key (wallet_addressのみ)
--   2. 複合UNIQUE制約 (wallet_address, tenant_id)
--
-- Supabaseが最初に見つかった制約(1)を使用するため、
-- tenant_idが異なる場合でもconflictが発生
--
-- 解決策: 単一カラムのUNIQUE制約を削除し、複合制約のみを残す
-- ========================================

-- wallet_address単独のUNIQUE制約を削除
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_wallet_address_key;

-- 確認用メッセージ
DO $$
BEGIN
  RAISE NOTICE '✅ Removed duplicate UNIQUE constraint on wallet_address';
  RAISE NOTICE '📝 Only composite UNIQUE(wallet_address, tenant_id) remains';
  RAISE NOTICE '💡 This allows upsert to work correctly';
END $$;
