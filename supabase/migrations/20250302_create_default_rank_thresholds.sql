-- ========================================
-- デフォルトランク閾値テーブル作成
-- ========================================
-- 目的: FLOWプラン（テナント未承認）ユーザー向けのデフォルト閾値を管理
--       スーパーアドミンが設定可能
-- ========================================

-- テーブル作成
CREATE TABLE IF NOT EXISTS default_rank_thresholds (
  -- 主キー
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ランク情報
  rank_level INTEGER NOT NULL UNIQUE, -- 1, 2, 3, 4, 5
  threshold INTEGER NOT NULL,         -- 閾値（総合KODOMIポイント）
  rank_name TEXT NOT NULL,            -- ランク名（例: "Seed Supporter"）
  rank_color TEXT NOT NULL,           -- カラーコード（例: "#90ee90"）

  -- メタデータ
  description TEXT,                   -- 説明（オプション）
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- 制約
  CONSTRAINT valid_rank_level CHECK (rank_level >= 1 AND rank_level <= 10),
  CONSTRAINT valid_threshold CHECK (threshold >= 0),
  CONSTRAINT valid_color CHECK (rank_color ~ '^#[0-9a-fA-F]{6}$')
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_default_thresholds_level ON default_rank_thresholds(rank_level);
CREATE INDEX IF NOT EXISTS idx_default_thresholds_threshold ON default_rank_thresholds(threshold);

-- デフォルト値を挿入
INSERT INTO default_rank_thresholds (rank_level, threshold, rank_name, rank_color, description) VALUES
  (1, 100, 'Seed Supporter', '#90ee90', '新たな応援の種'),
  (2, 300, 'Grow Supporter', '#32cd32', '成長する応援者'),
  (3, 600, 'Bloom Supporter', '#ff69b4', '花開く応援'),
  (4, 1000, 'Mythic Patron', '#9370db', '神話級のパトロン'),
  (5, 1500, 'Legendary Supporter', '#ffd700', '伝説の支援者')
ON CONFLICT (rank_level) DO NOTHING;

-- ========================================
-- Row Level Security (RLS) 設定
-- ========================================

ALTER TABLE default_rank_thresholds ENABLE ROW LEVEL SECURITY;

-- 読み取りは全員可能
CREATE POLICY "Default thresholds are publicly readable"
  ON default_rank_thresholds FOR SELECT
  USING (true);

-- 書き込みはサービスロールのみ
CREATE POLICY "Default thresholds are writable by service role"
  ON default_rank_thresholds FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- トリガー（自動更新）
-- ========================================

CREATE TRIGGER trigger_default_thresholds_updated
  BEFORE UPDATE ON default_rank_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION update_last_updated();

-- ========================================
-- 完了メッセージ
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ default_rank_thresholds table created successfully';
  RAISE NOTICE '📊 Default rank levels: 1-5';
  RAISE NOTICE '🎨 Thresholds: 100, 300, 600, 1000, 1500 pts';
  RAISE NOTICE '🔒 RLS enabled: Public read, Service role write';
END $$;
