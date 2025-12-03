-- Migration: Add plan_configurations table
-- Description: Stores dynamic pricing and feature configuration for each tenant plan
-- Date: 2025-12-03

-- Create plan_configurations table
CREATE TABLE IF NOT EXISTS plan_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan VARCHAR(50) NOT NULL UNIQUE, -- 'STUDIO', 'STUDIO_PRO', 'STUDIO_PRO_MAX'
  monthly_fee INTEGER NOT NULL DEFAULT 0, -- 月額料金 (円)
  max_hubs INTEGER NOT NULL DEFAULT 1, -- 最大GIFT HUB数
  sbt_ranks INTEGER NOT NULL DEFAULT 3, -- SBTランク段階数
  has_custom_token BOOLEAN NOT NULL DEFAULT false, -- カスタムトークン（拡張予定）
  has_advanced_analytics BOOLEAN NOT NULL DEFAULT false, -- 高度な分析機能
  has_api_integration BOOLEAN NOT NULL DEFAULT false, -- API連携
  has_priority_support BOOLEAN NOT NULL DEFAULT false, -- 優先サポート
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on plan for fast lookups
CREATE INDEX IF NOT EXISTS idx_plan_configurations_plan ON plan_configurations(plan);

-- Insert default configurations
INSERT INTO plan_configurations (plan, monthly_fee, max_hubs, sbt_ranks, has_custom_token, has_advanced_analytics, has_api_integration, has_priority_support)
VALUES
  ('STUDIO', 1500, 1, 3, false, false, false, false),
  ('STUDIO_PRO', 3800, 3, 5, true, false, false, false),
  ('STUDIO_PRO_MAX', 9800, 10, 10, true, true, true, true)
ON CONFLICT (plan) DO NOTHING;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_plan_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_plan_configurations_updated_at
  BEFORE UPDATE ON plan_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_configurations_updated_at();

-- Add comment to table
COMMENT ON TABLE plan_configurations IS 'Stores dynamic pricing and feature configuration for each tenant plan';
COMMENT ON COLUMN plan_configurations.plan IS 'Plan identifier: STUDIO, STUDIO_PRO, or STUDIO_PRO_MAX';
COMMENT ON COLUMN plan_configurations.monthly_fee IS 'Monthly subscription fee in JPY';
COMMENT ON COLUMN plan_configurations.max_hubs IS 'Maximum number of GIFT HUBs allowed';
COMMENT ON COLUMN plan_configurations.sbt_ranks IS 'Number of SBT rank tiers (1-10)';
COMMENT ON COLUMN plan_configurations.has_custom_token IS 'Whether custom token feature is enabled (future expansion)';
COMMENT ON COLUMN plan_configurations.has_advanced_analytics IS 'Whether advanced analytics feature is enabled';
COMMENT ON COLUMN plan_configurations.has_api_integration IS 'Whether API integration feature is enabled';
COMMENT ON COLUMN plan_configurations.has_priority_support IS 'Whether priority support is provided';
