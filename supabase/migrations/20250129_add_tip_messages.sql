-- ========================================
-- TIPメッセージ保存機能の追加
-- ========================================
-- Created: 2025-01-29
-- Description: TIP時のメッセージをDBに保存し、AI分析でkodomiに反映

-- ========================================
-- 1. score_transactionsテーブルにmessageフィールド追加
-- ========================================

ALTER TABLE score_transactions
ADD COLUMN IF NOT EXISTS message TEXT;

ALTER TABLE score_transactions
ADD COLUMN IF NOT EXISTS sentiment_score INTEGER DEFAULT 50;

ALTER TABLE score_transactions
ADD COLUMN IF NOT EXISTS sentiment_label TEXT DEFAULT 'neutral';

-- ========================================
-- 2. user_scoresテーブルにAI分析スコア追加
-- ========================================

ALTER TABLE user_scores
ADD COLUMN IF NOT EXISTS ai_quality_score NUMERIC NOT NULL DEFAULT 0;

-- ========================================
-- 3. コメント追加
-- ========================================

COMMENT ON COLUMN score_transactions.message IS
'TIP時のメッセージ内容 - AI分析でkodomiの質的評価に使用';

COMMENT ON COLUMN score_transactions.sentiment_score IS
'AIによる感情分析スコア（0-100）: 100=非常にポジティブ、50=中立、0=非常にネガティブ';

COMMENT ON COLUMN score_transactions.sentiment_label IS
'感情ラベル: positive / neutral / negative';

COMMENT ON COLUMN user_scores.ai_quality_score IS
'AI質的スコア（メッセージ内容の文脈理解・感情分析の累積評価） - kodomi算出に使用';

-- ========================================
-- 4. インデックス作成（検索パフォーマンス向上）
-- ========================================

CREATE INDEX IF NOT EXISTS idx_score_tx_sentiment ON score_transactions(sentiment_label);
CREATE INDEX IF NOT EXISTS idx_score_tx_has_message ON score_transactions((message IS NOT NULL));

-- ========================================
-- 5. 既存レコードの更新
-- ========================================

-- メッセージがnullのレコードに対してデフォルト値を設定
UPDATE score_transactions
SET
  sentiment_score = 50,
  sentiment_label = 'neutral'
WHERE sentiment_score IS NULL OR sentiment_label IS NULL;

-- ========================================
-- 完了
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ TIP messages migration completed successfully';
  RAISE NOTICE '💬 Added fields: message, sentiment_score, sentiment_label';
  RAISE NOTICE '🤖 AI analysis: Messages will be analyzed for kodomi calculation';
  RAISE NOTICE '📊 New kodomi formula: (回数 + AI質的スコア) × (1 + 連続ボーナス)';
END $$;
