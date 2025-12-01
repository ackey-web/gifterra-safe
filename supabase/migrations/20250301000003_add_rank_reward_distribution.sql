-- ========================================
-- ランク特典自動配布履歴テーブル
-- ========================================
-- 目的: ランク到達時のSBT自動ミント・フラグNFT自動配布履歴を記録
--
-- 実装内容:
-- 1. rank_reward_distributions テーブル追加
-- 2. 配布履歴の記録
-- 3. テナントごとの配布統計
-- ========================================

-- ========================================
-- 1. rank_reward_distributions テーブル作成
-- ========================================

CREATE TABLE IF NOT EXISTS rank_reward_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_address TEXT NOT NULL, -- ユーザーのウォレットアドレス
  rank_level INTEGER NOT NULL, -- 到達したランクレベル（1-5）

  -- KODOMI情報
  kodomi_value INTEGER NOT NULL, -- 到達時のKODOMI値
  kodomi_threshold INTEGER NOT NULL, -- その時点のランク閾値

  -- SBT情報
  sbt_minted BOOLEAN DEFAULT false, -- SBTがミントされたか
  sbt_token_id TEXT, -- ミントされたSBTのトークンID
  previous_sbt_burned BOOLEAN DEFAULT false, -- 旧SBTがバーンされたか
  previous_sbt_token_id TEXT, -- バーンされた旧SBTのトークンID

  -- フラグNFT情報
  flag_nft_id UUID, -- 配布されたフラグNFTのID（flag_nftsテーブル参照）
  flag_nft_distributed BOOLEAN DEFAULT false, -- フラグNFTが配布されたか
  flag_nft_token_id TEXT, -- ミントされたフラグNFTのトークンID

  -- トランザクション情報
  tx_hash TEXT, -- ブロックチェーントランザクションハッシュ
  block_number BIGINT, -- ブロック番号

  -- ステータス
  status TEXT DEFAULT 'pending', -- pending, completed, failed
  error_message TEXT, -- エラーメッセージ（失敗時）

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックス作成（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_rank_distributions_tenant_id ON rank_reward_distributions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rank_distributions_user_address ON rank_reward_distributions(user_address);
CREATE INDEX IF NOT EXISTS idx_rank_distributions_rank_level ON rank_reward_distributions(rank_level);
CREATE INDEX IF NOT EXISTS idx_rank_distributions_created_at ON rank_reward_distributions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rank_distributions_status ON rank_reward_distributions(status);

-- コメント追加
COMMENT ON TABLE rank_reward_distributions IS 'Rank reward distribution history (SBT auto-mint and Flag NFT distribution)';
COMMENT ON COLUMN rank_reward_distributions.tenant_id IS 'Tenant ID';
COMMENT ON COLUMN rank_reward_distributions.user_address IS 'User wallet address';
COMMENT ON COLUMN rank_reward_distributions.rank_level IS 'Achieved rank level (1-5)';
COMMENT ON COLUMN rank_reward_distributions.kodomi_value IS 'KODOMI value at achievement';
COMMENT ON COLUMN rank_reward_distributions.sbt_minted IS 'Whether SBT was minted';
COMMENT ON COLUMN rank_reward_distributions.flag_nft_distributed IS 'Whether Flag NFT was distributed';
COMMENT ON COLUMN rank_reward_distributions.status IS 'Distribution status: pending, completed, failed';

-- ========================================
-- 2. updated_at 自動更新トリガー
-- ========================================

CREATE OR REPLACE FUNCTION update_rank_distributions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rank_distributions_updated_at
  BEFORE UPDATE ON rank_reward_distributions
  FOR EACH ROW
  EXECUTE FUNCTION update_rank_distributions_updated_at();

-- ========================================
-- 3. 配布統計ビュー
-- ========================================

CREATE OR REPLACE VIEW v_rank_distribution_stats AS
SELECT
  tenant_id,
  rank_level,
  COUNT(*) as total_distributions,
  COUNT(*) FILTER (WHERE sbt_minted = true) as sbt_mints,
  COUNT(*) FILTER (WHERE flag_nft_distributed = true) as flag_nft_distributions,
  COUNT(*) FILTER (WHERE status = 'completed') as successful_distributions,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_distributions,
  MAX(created_at) as last_distribution_at
FROM rank_reward_distributions
GROUP BY tenant_id, rank_level
ORDER BY tenant_id, rank_level;

COMMENT ON VIEW v_rank_distribution_stats IS 'Statistics of rank reward distributions by tenant and rank level';

-- ========================================
-- 4. ユーザー別配布履歴ビュー
-- ========================================
-- Note: flag_nftsテーブルが存在する場合のみ結合
-- テーブルが存在しない場合はビュー作成をスキップ

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'flag_nfts') THEN
    CREATE OR REPLACE VIEW v_user_rank_history AS
    SELECT
      rrd.user_address,
      rrd.tenant_id,
      rrd.rank_level,
      rrd.kodomi_value,
      rrd.sbt_minted,
      rrd.flag_nft_distributed,
      fn.name as flag_nft_name,
      fn.category as flag_nft_category,
      fn.image as flag_nft_image,
      rrd.status,
      rrd.created_at
    FROM rank_reward_distributions rrd
    LEFT JOIN flag_nfts fn ON rrd.flag_nft_id = fn.id
    ORDER BY rrd.created_at DESC;

    COMMENT ON VIEW v_user_rank_history IS 'User rank achievement and reward distribution history';
    RAISE NOTICE '✅ v_user_rank_history view created with flag_nfts join';
  ELSE
    CREATE OR REPLACE VIEW v_user_rank_history AS
    SELECT
      rrd.user_address,
      rrd.tenant_id,
      rrd.rank_level,
      rrd.kodomi_value,
      rrd.sbt_minted,
      rrd.flag_nft_distributed,
      NULL::TEXT as flag_nft_name,
      NULL::TEXT as flag_nft_category,
      NULL::TEXT as flag_nft_image,
      rrd.status,
      rrd.created_at
    FROM rank_reward_distributions rrd
    ORDER BY rrd.created_at DESC;

    COMMENT ON VIEW v_user_rank_history IS 'User rank achievement and reward distribution history (flag_nfts table not found)';
    RAISE NOTICE '⚠️  v_user_rank_history view created without flag_nfts join (table does not exist)';
  END IF;
END $$;

-- ========================================
-- 完了メッセージ
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Rank reward distribution migration completed';
  RAISE NOTICE 'View stats: SELECT * FROM v_rank_distribution_stats;';
  RAISE NOTICE 'View user history: SELECT * FROM v_user_rank_history LIMIT 10;';
END $$;
