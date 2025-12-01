-- ========================================
-- score_params テーブルにカラム追加
-- ========================================
-- 目的: useUserKodomi.tsで使用される新しいスコアパラメータカラムを追加
--
-- 問題: 既存のscore_paramsテーブルには weight_economic, weight_resonance しかなく、
--       useUserKodomi.tsが要求する nht_weight, streak_weight, ai_quality_weight,
--       message_quality_weight カラムが存在しないため400エラーが発生
--
-- 解決策: 必要なカラムを追加し、デフォルト値を設定
-- ========================================

-- 新しいカラムを追加（存在しない場合のみ）
ALTER TABLE score_params
ADD COLUMN IF NOT EXISTS nht_weight NUMERIC DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS streak_weight NUMERIC DEFAULT 10.0,
ADD COLUMN IF NOT EXISTS ai_quality_weight NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS message_quality_weight NUMERIC DEFAULT 1.0;

-- 既存のレコードがある場合、新しいカラムにデフォルト値を設定
UPDATE score_params
SET
  nht_weight = COALESCE(nht_weight, 2.0),
  streak_weight = COALESCE(streak_weight, 10.0),
  ai_quality_weight = COALESCE(ai_quality_weight, 1.0),
  message_quality_weight = COALESCE(message_quality_weight, 1.0)
WHERE nht_weight IS NULL
   OR streak_weight IS NULL
   OR ai_quality_weight IS NULL
   OR message_quality_weight IS NULL;

-- 確認用メッセージ
DO $$
BEGIN
  RAISE NOTICE '✅ score_params columns added successfully';
  RAISE NOTICE '📊 New columns: nht_weight, streak_weight, ai_quality_weight, message_quality_weight';
  RAISE NOTICE '💡 Default values: nht_weight=2.0, streak_weight=10.0, ai_quality_weight=1.0, message_quality_weight=1.0';
END $$;
