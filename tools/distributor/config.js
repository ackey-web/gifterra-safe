import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * GifterraDistributor Configuration
 *
 * Environment variables:
 * - RPC_URL: Blockchain RPC endpoint (required)
 * - REWARDNFT_ADDRESS: RewardNFT_v2 contract address (required)
 * - DISTRIBUTOR_WALLET_KEY: Private key for DISTRIBUTOR_ROLE (required)
 * - RULES_PATH: Path to rules.json (default: ./config/rules.json)
 * - INDEXER_LOG_DIR: Path to indexer JSONL output (default: ../indexer/logs/indexer)
 * - STATE_DIR: Path to state directory (default: ./state)
 * - ERROR_LOG_DIR: Path to error log directory (default: ./logs)
 * - RETRY_MAX_ATTEMPTS: Maximum retry attempts (default: 3)
 * - RETRY_INITIAL_DELAY_MS: Initial retry delay in ms (default: 1000)
 * - POLL_INTERVAL_MS: JSONL file polling interval (default: 2000)
 */

export const config = {
  // RPC Configuration
  rpcUrl: process.env.RPC_URL || '',

  // Contract Configuration
  rewardNFTAddress: process.env.REWARDNFT_ADDRESS || '',

  // Wallet Configuration (IMPORTANT: Use secure key management in production)
  distributorWalletKey: process.env.DISTRIBUTOR_WALLET_KEY || '',

  // Paths
  rulesPath: process.env.RULES_PATH || join(__dirname, 'config', 'rules.json'),
  indexerLogDir: process.env.INDEXER_LOG_DIR || join(__dirname, '..', 'indexer', 'logs', 'indexer'),
  stateDir: process.env.STATE_DIR || join(__dirname, 'state'),
  errorLogDir: process.env.ERROR_LOG_DIR || join(__dirname, 'logs'),

  // Retry Configuration
  retryMaxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
  retryInitialDelayMs: parseInt(process.env.RETRY_INITIAL_DELAY_MS || '1000', 10),

  // Polling Configuration
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '2000', 10),
};

/**
 * Validate required configuration
 */
export function validateConfig() {
  const errors = [];

  if (!config.rpcUrl) {
    errors.push('RPC_URL is required');
  }

  if (!config.rewardNFTAddress) {
    errors.push('REWARDNFT_ADDRESS is required');
  }

  if (!config.distributorWalletKey) {
    errors.push('DISTRIBUTOR_WALLET_KEY is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  console.log('✅ Configuration validated');
  console.log(`📡 RPC: ${config.rpcUrl}`);
  console.log(`🎁 RewardNFT: ${config.rewardNFTAddress}`);
  console.log(`📜 Rules: ${config.rulesPath}`);
  console.log(`📂 Indexer logs: ${config.indexerLogDir}`);
}
