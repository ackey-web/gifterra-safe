-- ========================================
-- Resonance計算パラメータの追加
-- ========================================
-- Created: 2025-02-29
-- Description: KODOMI ゲージ（Resonance軸）の計算パラメーターを調整可能にする

-- score_paramsテーブルに新しい列を追加
ALTER TABLE score_params
ADD COLUMN IF NOT EXISTS nht_weight NUMERIC NOT NULL DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS streak_weight NUMERIC NOT NULL DEFAULT 10.0,
ADD COLUMN IF NOT EXISTS ai_quality_weight NUMERIC NOT NULL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS message_quality_weight NUMERIC NOT NULL DEFAULT 1.0;

-- コメント追加
COMMENT ON COLUMN score_params.nht_weight IS 'NHTチップ回数の重み（engagementScore計算用）';
COMMENT ON COLUMN score_params.streak_weight IS 'ストリーク日数の重み（engagementScore計算用）';
COMMENT ON COLUMN score_params.ai_quality_weight IS 'AI質的スコアの重み（engagementScore計算用）';
COMMENT ON COLUMN score_params.message_quality_weight IS 'メッセージ品質スコアの重み（engagementScore計算用）';

-- 既存レコードを更新（デフォルト値を設定）
UPDATE score_params
SET
  nht_weight = 2.0,
  streak_weight = 10.0,
  ai_quality_weight = 1.0,
  message_quality_weight = 1.0
WHERE nht_weight IS NULL OR streak_weight IS NULL OR ai_quality_weight IS NULL OR message_quality_weight IS NULL;

-- 正の値制約を追加
ALTER TABLE score_params
ADD CONSTRAINT resonance_weights_positive CHECK (
  nht_weight >= 0 AND
  streak_weight >= 0 AND
  ai_quality_weight >= 0 AND
  message_quality_weight >= 0
);
