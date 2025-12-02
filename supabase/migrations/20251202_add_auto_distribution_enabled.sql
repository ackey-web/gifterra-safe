-- Add auto_distribution_enabled column to tenant_applications table
-- This column controls whether to use contract.tip() for automatic SBT distribution
-- when users send tokens to this tenant owner

ALTER TABLE tenant_applications
ADD COLUMN IF NOT EXISTS auto_distribution_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN tenant_applications.auto_distribution_enabled IS 'When enabled, all incoming transfers to this tenant owner will use contract.tip() for automatic SBT/NFT distribution. When disabled, direct ERC20 transfer is used.';
