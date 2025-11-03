-- ========================================
-- 二軸スコアシステム データベーススキーマ
-- ========================================
-- Created: 2025-01-28
-- Description: 💸 Economic / 🔥 Resonance 二軸スコアシステムのテーブル定義

-- ========================================
-- 1. ユーザースコアテーブル
-- ========================================

CREATE TABLE IF NOT EXISTS user_scores (
  -- 主キー
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL UNIQUE,

  -- 💸 Economic軸
  economic_raw TEXT NOT NULL DEFAULT '0', -- BigInt格納用（JPYC最小単位）
  economic_score NUMERIC NOT NULL DEFAULT 0, -- 正規化後スコア
  economic_level INTEGER NOT NULL DEFAULT 0, -- レベル（0-100）

  -- 🔥 Resonance軸
  resonance_raw INTEGER NOT NULL DEFAULT 0, -- 生の回数
  resonance_score NUMERIC NOT NULL DEFAULT 0, -- 正規化後スコア
  resonance_level INTEGER NOT NULL DEFAULT 0, -- レベル（0-100）
  resonance_count INTEGER NOT NULL DEFAULT 0, -- 応援回数
  resonance_streak INTEGER NOT NULL DEFAULT 0, -- 連続日数
  resonance_longest_streak INTEGER NOT NULL DEFAULT 0, -- 最長連続
  resonance_last_date TIMESTAMP WITH TIME ZONE, -- 最終応援日

  -- 📊 Composite軸
  composite_score NUMERIC NOT NULL DEFAULT 0, -- 合成スコア

  -- メタデータ
  display_name TEXT,
  avatar TEXT,
  badge TEXT,
  title TEXT,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- インデックス
  CONSTRAINT address_lowercase CHECK (address = LOWER(address))
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_scores_address ON user_scores(address);
CREATE INDEX IF NOT EXISTS idx_user_scores_economic ON user_scores(economic_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_scores_resonance ON user_scores(resonance_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_scores_composite ON user_scores(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_scores_updated ON user_scores(last_updated DESC);

-- ========================================
-- 2. スコアトランザクションログ
-- ========================================

CREATE TABLE IF NOT EXISTS score_transactions (
  -- 主キー
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- トランザクション情報
  user_address TEXT NOT NULL,
  token_address TEXT NOT NULL, -- address(0) = アクション
  amount_raw TEXT NOT NULL, -- BigInt格納用
  axis TEXT NOT NULL, -- "ECONOMIC" or "RESONANCE"
  trace_id TEXT NOT NULL, -- ブロックチェーンのtraceId

  -- タイムスタンプ
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- インデックス
  CONSTRAINT axis_check CHECK (axis IN ('ECONOMIC', 'RESONANCE'))
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_score_tx_user ON score_transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_score_tx_timestamp ON score_transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_score_tx_trace ON score_transactions(trace_id);
CREATE INDEX IF NOT EXISTS idx_score_tx_axis ON score_transactions(axis);

-- ========================================
-- 3. スコアパラメータ管理
-- ========================================

CREATE TABLE IF NOT EXISTS score_params (
  -- 主キー
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- パラメータ
  weight_economic INTEGER NOT NULL, -- Basis Points (100 = 1.0)
  weight_resonance INTEGER NOT NULL, -- Basis Points
  curve TEXT NOT NULL, -- "Linear", "Sqrt", "Log"

  -- タイムスタンプ
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- 制約
  CONSTRAINT curve_check CHECK (curve IN ('Linear', 'Sqrt', 'Log')),
  CONSTRAINT weight_positive CHECK (weight_economic > 0 AND weight_resonance > 0)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_score_params_updated ON score_params(last_updated DESC);

-- デフォルトパラメータ挿入
INSERT INTO score_params (weight_economic, weight_resonance, curve, last_updated)
VALUES (100, 100, 'Sqrt', NOW())
ON CONFLICT DO NOTHING;

-- ========================================
-- 4. トークン軸管理
-- ========================================

CREATE TABLE IF NOT EXISTS token_axes (
  -- 主キー
  token TEXT PRIMARY KEY, -- トークンアドレス（小文字）
  is_economic BOOLEAN NOT NULL, -- true = Economic, false = Resonance

  -- タイムスタンプ
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- 制約
  CONSTRAINT token_lowercase CHECK (token = LOWER(token))
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_token_axes_type ON token_axes(is_economic);

-- ========================================
-- 5. デイリースナップショット
-- ========================================

CREATE TABLE IF NOT EXISTS daily_snapshots (
  -- 主キー
  date DATE PRIMARY KEY, -- YYYY-MM-DD
  data JSONB NOT NULL, -- スナップショット全体（ランキング、分布、パラメータ）

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON daily_snapshots(date DESC);

-- ========================================
-- 6. テナント別スコア（オプション）
-- ========================================

CREATE TABLE IF NOT EXISTS tenant_scores (
  -- 主キー
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 外部キー
  user_address TEXT NOT NULL,
  tenant_id TEXT NOT NULL,

  -- スコア
  economic_score NUMERIC NOT NULL DEFAULT 0,
  resonance_score NUMERIC NOT NULL DEFAULT 0,
  composite_score NUMERIC NOT NULL DEFAULT 0,

  -- タイムスタンプ
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- ユニーク制約
  CONSTRAINT tenant_scores_unique UNIQUE (user_address, tenant_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_tenant_scores_user ON tenant_scores(user_address);
CREATE INDEX IF NOT EXISTS idx_tenant_scores_tenant ON tenant_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_scores_composite ON tenant_scores(composite_score DESC);

-- ========================================
-- 7. インデクサ状態管理
-- ========================================

CREATE TABLE IF NOT EXISTS indexer_state (
  -- 主キー
  id INTEGER PRIMARY KEY DEFAULT 1, -- シングルトン

  -- ブロックチェーン状態
  last_processed_block INTEGER NOT NULL DEFAULT 0,
  last_processed_timestamp TIMESTAMP WITH TIME ZONE,

  -- 統計
  total_users INTEGER NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,

  -- タイムスタンプ
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- シングルトン制約
  CONSTRAINT singleton_check CHECK (id = 1)
);

-- 初期状態挿入
INSERT INTO indexer_state (id, last_processed_block, last_updated)
VALUES (1, 0, NOW())
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- 8. Row Level Security (RLS) 設定
-- ========================================

-- user_scores: 読み取り公開、書き込みはサービスロールのみ
ALTER TABLE user_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User scores are publicly readable"
  ON user_scores FOR SELECT
  USING (true);

CREATE POLICY "User scores are writable by service role"
  ON user_scores FOR ALL
  USING (auth.role() = 'service_role');

-- score_transactions: 読み取り公開、書き込みはサービスロールのみ
ALTER TABLE score_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Score transactions are publicly readable"
  ON score_transactions FOR SELECT
  USING (true);

CREATE POLICY "Score transactions are writable by service role"
  ON score_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- score_params: 読み取り公開、書き込みはサービスロールのみ
ALTER TABLE score_params ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Score params are publicly readable"
  ON score_params FOR SELECT
  USING (true);

CREATE POLICY "Score params are writable by service role"
  ON score_params FOR ALL
  USING (auth.role() = 'service_role');

-- token_axes: 読み取り公開、書き込みはサービスロールのみ
ALTER TABLE token_axes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Token axes are publicly readable"
  ON token_axes FOR SELECT
  USING (true);

CREATE POLICY "Token axes are writable by service role"
  ON token_axes FOR ALL
  USING (auth.role() = 'service_role');

-- daily_snapshots: 読み取り公開、書き込みはサービスロールのみ
ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Snapshots are publicly readable"
  ON daily_snapshots FOR SELECT
  USING (true);

CREATE POLICY "Snapshots are writable by service role"
  ON daily_snapshots FOR ALL
  USING (auth.role() = 'service_role');

-- tenant_scores: 読み取り公開、書き込みはサービスロールのみ
ALTER TABLE tenant_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant scores are publicly readable"
  ON tenant_scores FOR SELECT
  USING (true);

CREATE POLICY "Tenant scores are writable by service role"
  ON tenant_scores FOR ALL
  USING (auth.role() = 'service_role');

-- indexer_state: サービスロールのみアクセス可能
ALTER TABLE indexer_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Indexer state is readable by service role"
  ON indexer_state FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Indexer state is writable by service role"
  ON indexer_state FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- 9. 便利なビュー
-- ========================================

-- ランキングビュー（Composite）
CREATE OR REPLACE VIEW rankings_composite AS
SELECT
  ROW_NUMBER() OVER (ORDER BY composite_score DESC) AS rank,
  user_id,
  address,
  display_name,
  avatar,
  economic_score,
  resonance_score,
  composite_score,
  economic_level,
  resonance_level,
  badge,
  title
FROM user_scores
WHERE composite_score > 0
ORDER BY composite_score DESC
LIMIT 1000;

-- ランキングビュー（Economic）
CREATE OR REPLACE VIEW rankings_economic AS
SELECT
  ROW_NUMBER() OVER (ORDER BY economic_score DESC) AS rank,
  user_id,
  address,
  display_name,
  avatar,
  economic_score,
  resonance_score,
  composite_score,
  economic_level,
  resonance_level,
  badge,
  title
FROM user_scores
WHERE economic_score > 0
ORDER BY economic_score DESC
LIMIT 1000;

-- ランキングビュー（Resonance）
CREATE OR REPLACE VIEW rankings_resonance AS
SELECT
  ROW_NUMBER() OVER (ORDER BY resonance_score DESC) AS rank,
  user_id,
  address,
  display_name,
  avatar,
  economic_score,
  resonance_score,
  composite_score,
  economic_level,
  resonance_level,
  badge,
  title
FROM user_scores
WHERE resonance_score > 0
ORDER BY resonance_score DESC
LIMIT 1000;

-- ========================================
-- 10. トリガー（自動更新）
-- ========================================

-- last_updated自動更新トリガー
CREATE OR REPLACE FUNCTION update_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_scores_updated
  BEFORE UPDATE ON user_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_last_updated();

CREATE TRIGGER trigger_tenant_scores_updated
  BEFORE UPDATE ON tenant_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_last_updated();

-- ========================================
-- 完了
-- ========================================

-- マイグレーション完了メッセージ
DO $$
BEGIN
  RAISE NOTICE '✅ Score system schema migration completed successfully';
  RAISE NOTICE '📊 Tables created: user_scores, score_transactions, score_params, token_axes, daily_snapshots, tenant_scores, indexer_state';
  RAISE NOTICE '🔒 RLS policies enabled for all tables';
  RAISE NOTICE '📈 Ranking views created: rankings_composite, rankings_economic, rankings_resonance';
END $$;
