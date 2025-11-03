-- ========================================
-- トークン種別TIP回数フィールド追加
-- ========================================
-- Created: 2025-01-29
-- Description: Resonanceスコアにユーティリティトークンとeconomicトークンの回数を分離して記録

-- ========================================
-- 1. user_scores テーブルにフィールド追加
-- ========================================

-- ユーティリティトークン（tNHT等）のTIP回数（重み1.0）
ALTER TABLE user_scores
ADD COLUMN IF NOT EXISTS resonance_utility_tips INTEGER NOT NULL DEFAULT 0;

-- Economic軸トークン（JPYC等）のTIP回数（重み0.3）
ALTER TABLE user_scores
ADD COLUMN IF NOT EXISTS resonance_economic_tips INTEGER NOT NULL DEFAULT 0;

-- ========================================
-- 2. コメント追加
-- ========================================

COMMENT ON COLUMN user_scores.resonance_utility_tips IS
'ユーティリティトークン（tNHT等）のTIP回数 - kodomi算出時に重み1.0で適用';

COMMENT ON COLUMN user_scores.resonance_economic_tips IS
'Economic軸トークン（JPYC等）のTIP回数 - kodomi算出時に重み1.0で適用（案A: 全トークン同重み、金額は含まない）';

COMMENT ON COLUMN user_scores.resonance_count IS
'応援回数合計 = resonance_utility_tips + resonance_economic_tips + purchases + claims';

COMMENT ON COLUMN user_scores.resonance_score IS
'貢献熱量度（kodomi） = (utility_tips + economic_tips) * (1 + floor(streak/7) * 0.1) - 案A: 回数のみ、全トークン同重み';

-- ========================================
-- 3. インデックス作成（オプション、パフォーマンスが必要な場合）
-- ========================================

-- CREATE INDEX IF NOT EXISTS idx_user_scores_utility_tips ON user_scores(resonance_utility_tips DESC);
-- CREATE INDEX IF NOT EXISTS idx_user_scores_economic_tips ON user_scores(resonance_economic_tips DESC);

-- ========================================
-- 完了
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Token type tip counts migration completed successfully';
  RAISE NOTICE '🔥 Added fields: resonance_utility_tips, resonance_economic_tips';
  RAISE NOTICE '⚖️ Weight configuration: Utility=1.0, Economic=1.0 (案A: 全トークン同重み)';
  RAISE NOTICE '📝 kodomi formula: (utility_tips + economic_tips) * (1 + streak_bonus)';
  RAISE NOTICE '💡 Design: 回数のみカウント、金額は含まない（法務リスク回避）';
END $$;
