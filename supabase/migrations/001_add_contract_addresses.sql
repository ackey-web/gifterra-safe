-- テナント申請テーブルにコントラクトアドレスカラムを追加
-- GifterraFactory.createTenant()で作成されるすべてのコントラクトアドレスを保存

ALTER TABLE tenant_applications
ADD COLUMN IF NOT EXISTS gifterra_address TEXT,
ADD COLUMN IF NOT EXISTS reward_nft_address TEXT,
ADD COLUMN IF NOT EXISTS pay_splitter_address TEXT,
ADD COLUMN IF NOT EXISTS flag_nft_address TEXT,
ADD COLUMN IF NOT EXISTS random_reward_engine_address TEXT;

-- インデックス作成（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_tenant_applications_gifterra_address
  ON tenant_applications(gifterra_address);

COMMENT ON COLUMN tenant_applications.gifterra_address IS 'Gifterraメインコントラクトアドレス';
COMMENT ON COLUMN tenant_applications.reward_nft_address IS 'RewardNFT（ランクSBT）コントラクトアドレス';
COMMENT ON COLUMN tenant_applications.pay_splitter_address IS 'PaySplitter（収益分配）コントラクトアドレス';
COMMENT ON COLUMN tenant_applications.flag_nft_address IS 'FlagNFT（フラグ管理）コントラクトアドレス';
COMMENT ON COLUMN tenant_applications.random_reward_engine_address IS 'RandomRewardEngine（ランダム報酬）コントラクトアドレス';
