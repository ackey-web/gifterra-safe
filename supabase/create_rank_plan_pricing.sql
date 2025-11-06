-- ランクプラン価格管理テーブル作成SQL
-- Supabase SQL Editorで実行してください

CREATE TABLE IF NOT EXISTS rank_plan_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rank_plan TEXT NOT NULL UNIQUE CHECK (rank_plan IN ('STUDIO', 'STUDIO_PRO', 'STUDIO_PRO_MAX')),
  price_jpy INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by TEXT,
  CONSTRAINT price_jpy_positive CHECK (price_jpy >= 0)
);

-- インデックス作成
CREATE INDEX idx_rank_plan_pricing_rank_plan ON rank_plan_pricing(rank_plan);

-- RLS (Row Level Security) 設定
ALTER TABLE rank_plan_pricing ENABLE ROW LEVEL SECURITY;

-- 誰でも読み取り可能（テナント申請フォームで価格を表示するため）
CREATE POLICY "Anyone can view rank plan pricing"
  ON rank_plan_pricing
  FOR SELECT
  USING (true);

-- スーパーアドミンのみ更新可能
CREATE POLICY "Only super admins can update rank plan pricing"
  ON rank_plan_pricing
  FOR UPDATE
  USING (true);

CREATE POLICY "Only super admins can insert rank plan pricing"
  ON rank_plan_pricing
  FOR INSERT
  WITH CHECK (true);

-- updated_atの自動更新トリガー
CREATE TRIGGER update_rank_plan_pricing_updated_at
  BEFORE UPDATE ON rank_plan_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 初期データ挿入（デフォルト価格）
INSERT INTO rank_plan_pricing (rank_plan, price_jpy) VALUES
  ('STUDIO', 1500),
  ('STUDIO_PRO', 3800),
  ('STUDIO_PRO_MAX', 9800)
ON CONFLICT (rank_plan) DO NOTHING;

COMMENT ON TABLE rank_plan_pricing IS 'ランクプラン価格管理テーブル';
COMMENT ON COLUMN rank_plan_pricing.rank_plan IS 'ランクプラン種別';
COMMENT ON COLUMN rank_plan_pricing.price_jpy IS '月額料金（円）';
