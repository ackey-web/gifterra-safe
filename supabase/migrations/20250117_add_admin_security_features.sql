-- セキュリティ設定テーブル（グローバル設定）
CREATE TABLE IF NOT EXISTS security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',

  -- トランザクション制限設定
  max_transaction_amount NUMERIC DEFAULT 100000, -- 1回の最大送金額（JPYC）
  daily_transaction_limit NUMERIC DEFAULT 500000, -- 1日の送金上限（JPYC）
  hourly_transaction_limit NUMERIC DEFAULT 100000, -- 1時間の送金上限（JPYC）
  high_amount_threshold NUMERIC DEFAULT 50000, -- 高額送金の閾値（追加確認が必要）

  -- 異常検知設定
  enable_anomaly_detection BOOLEAN DEFAULT TRUE,
  suspicious_transaction_count INTEGER DEFAULT 5, -- 疑わしい取引とみなす短時間の送金回数
  suspicious_time_window INTEGER DEFAULT 300, -- 疑わしいとみなす時間窓（秒）
  enable_geo_detection BOOLEAN DEFAULT FALSE, -- 地域ベースの異常検知（今後実装）

  -- その他
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id)
);

-- 初期設定を挿入
INSERT INTO security_settings (tenant_id)
VALUES ('default')
ON CONFLICT (tenant_id) DO NOTHING;

-- アカウント凍結テーブル
CREATE TABLE IF NOT EXISTS account_freezes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  wallet_address TEXT NOT NULL,

  -- 凍結情報
  is_frozen BOOLEAN DEFAULT TRUE,
  freeze_reason TEXT NOT NULL, -- 凍結理由
  freeze_type TEXT NOT NULL DEFAULT 'manual', -- manual, auto_anomaly, auto_limit
  frozen_by TEXT, -- 凍結したアドミンのウォレットアドレス
  frozen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 解除情報
  unfrozen_at TIMESTAMPTZ,
  unfrozen_by TEXT,
  unfreeze_reason TEXT,

  -- メタデータ
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, wallet_address)
);

-- インデックス
CREATE INDEX idx_account_freezes_wallet ON account_freezes(wallet_address, tenant_id);
CREATE INDEX idx_account_freezes_frozen ON account_freezes(is_frozen) WHERE is_frozen = TRUE;

-- RLS設定
ALTER TABLE account_freezes ENABLE ROW LEVEL SECURITY;

-- 管理者のみがアクセス可能
CREATE POLICY "Only admins can manage freezes"
  ON account_freezes
  FOR ALL
  USING (false); -- フロントエンドからは直接アクセス不可、管理画面のみ

-- 送金履歴テーブル（異常検知用）
CREATE TABLE IF NOT EXISTS transaction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',

  -- 送金情報
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  token_symbol TEXT DEFAULT 'JPYC',

  -- トランザクション情報
  tx_hash TEXT,
  block_number BIGINT,

  -- 異常検知フラグ
  is_suspicious BOOLEAN DEFAULT FALSE,
  anomaly_score NUMERIC, -- 0-100のスコア
  anomaly_reasons TEXT[], -- 異常と判断された理由のリスト

  -- メタデータ
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_transaction_history_from ON transaction_history(from_address, tenant_id);
CREATE INDEX idx_transaction_history_created ON transaction_history(created_at DESC);
CREATE INDEX idx_transaction_history_suspicious ON transaction_history(is_suspicious) WHERE is_suspicious = TRUE;

-- RLS設定
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の送金履歴のみ閲覧可能
CREATE POLICY "Users can view their own transactions"
  ON transaction_history
  FOR SELECT
  USING (from_address = lower(auth.jwt() ->> 'sub'));

-- user_profilesテーブルに凍結フラグを追加
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS freeze_reason TEXT;

-- 凍結されたユーザーを除外するビューを更新
CREATE OR REPLACE VIEW active_user_profiles AS
SELECT * FROM user_profiles
WHERE (is_deleted = FALSE OR is_deleted IS NULL)
  AND (is_frozen = FALSE OR is_frozen IS NULL);

-- コメント追加
COMMENT ON TABLE security_settings IS 'グローバルセキュリティ設定';
COMMENT ON TABLE account_freezes IS 'アカウント凍結履歴';
COMMENT ON TABLE transaction_history IS '送金履歴と異常検知データ';
COMMENT ON COLUMN user_profiles.is_frozen IS 'アカウント凍結フラグ';
COMMENT ON COLUMN user_profiles.frozen_at IS '凍結日時';
COMMENT ON COLUMN user_profiles.freeze_reason IS '凍結理由';

-- 関数: トランザクション制限チェック
CREATE OR REPLACE FUNCTION check_transaction_limits(
  p_wallet_address TEXT,
  p_amount NUMERIC,
  p_tenant_id TEXT DEFAULT 'default'
)
RETURNS TABLE(
  allowed BOOLEAN,
  reason TEXT,
  current_hourly NUMERIC,
  current_daily NUMERIC
) AS $$
DECLARE
  v_settings RECORD;
  v_hourly_total NUMERIC;
  v_daily_total NUMERIC;
BEGIN
  -- セキュリティ設定を取得
  SELECT * INTO v_settings FROM security_settings WHERE tenant_id = p_tenant_id;

  -- 1時間以内の送金合計
  SELECT COALESCE(SUM(amount), 0) INTO v_hourly_total
  FROM transaction_history
  WHERE from_address = LOWER(p_wallet_address)
    AND tenant_id = p_tenant_id
    AND created_at > NOW() - INTERVAL '1 hour';

  -- 1日以内の送金合計
  SELECT COALESCE(SUM(amount), 0) INTO v_daily_total
  FROM transaction_history
  WHERE from_address = LOWER(p_wallet_address)
    AND tenant_id = p_tenant_id
    AND created_at > NOW() - INTERVAL '1 day';

  -- チェック
  IF p_amount > v_settings.max_transaction_amount THEN
    RETURN QUERY SELECT FALSE, '1回の送金上限を超えています', v_hourly_total, v_daily_total;
  ELSIF v_hourly_total + p_amount > v_settings.hourly_transaction_limit THEN
    RETURN QUERY SELECT FALSE, '1時間の送金上限を超えています', v_hourly_total, v_daily_total;
  ELSIF v_daily_total + p_amount > v_settings.daily_transaction_limit THEN
    RETURN QUERY SELECT FALSE, '1日の送金上限を超えています', v_hourly_total, v_daily_total;
  ELSE
    RETURN QUERY SELECT TRUE, 'OK', v_hourly_total, v_daily_total;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 関数: 異常検知
CREATE OR REPLACE FUNCTION detect_transaction_anomaly(
  p_wallet_address TEXT,
  p_amount NUMERIC,
  p_tenant_id TEXT DEFAULT 'default'
)
RETURNS TABLE(
  is_suspicious BOOLEAN,
  anomaly_score NUMERIC,
  reasons TEXT[]
) AS $$
DECLARE
  v_settings RECORD;
  v_recent_count INTEGER;
  v_score NUMERIC := 0;
  v_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- セキュリティ設定を取得
  SELECT * INTO v_settings FROM security_settings WHERE tenant_id = p_tenant_id;

  IF NOT v_settings.enable_anomaly_detection THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, ARRAY[]::TEXT[];
    RETURN;
  END IF;

  -- 短時間での送金回数をチェック
  SELECT COUNT(*) INTO v_recent_count
  FROM transaction_history
  WHERE from_address = LOWER(p_wallet_address)
    AND tenant_id = p_tenant_id
    AND created_at > NOW() - (v_settings.suspicious_time_window || ' seconds')::INTERVAL;

  IF v_recent_count >= v_settings.suspicious_transaction_count THEN
    v_score := v_score + 40;
    v_reasons := array_append(v_reasons, '短時間に多数の送金');
  END IF;

  -- 高額送金チェック
  IF p_amount > v_settings.high_amount_threshold THEN
    v_score := v_score + 30;
    v_reasons := array_append(v_reasons, '高額送金');
  END IF;

  -- 通常の送金パターンと異なるかチェック（簡易版）
  DECLARE
    v_avg_amount NUMERIC;
  BEGIN
    SELECT AVG(amount) INTO v_avg_amount
    FROM transaction_history
    WHERE from_address = LOWER(p_wallet_address)
      AND tenant_id = p_tenant_id
      AND created_at > NOW() - INTERVAL '30 days';

    IF v_avg_amount IS NOT NULL AND p_amount > v_avg_amount * 5 THEN
      v_score := v_score + 20;
      v_reasons := array_append(v_reasons, '通常の送金額を大きく超過');
    END IF;
  END;

  -- 初回送金で高額
  DECLARE
    v_tx_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_tx_count
    FROM transaction_history
    WHERE from_address = LOWER(p_wallet_address)
      AND tenant_id = p_tenant_id;

    IF v_tx_count = 0 AND p_amount > 10000 THEN
      v_score := v_score + 10;
      v_reasons := array_append(v_reasons, '初回送金で高額');
    END IF;
  END;

  RETURN QUERY SELECT
    v_score >= 50,
    v_score,
    v_reasons;
END;
$$ LANGUAGE plpgsql;
