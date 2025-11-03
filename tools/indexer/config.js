import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

/**
 * Configuration loader
 * Reads from environment variables and provides defaults
 */
export const config = {
  // RPC Configuration
  rpcUrl: process.env.RPC_URL || '',

  // Starting block (undefined = latest block)
  startBlock: process.env.START_BLOCK ? BigInt(process.env.START_BLOCK) : undefined,

  // Contract addresses (undefined = skip that contract)
  contracts: {
    splitter: process.env.SPLITTER_ADDRESS || undefined,
    journeypass: process.env.JOURNEYPASS_ADDRESS || undefined,
    rewardNFT: process.env.REWARDNFT_ADDRESS || undefined,
  },

  // Confirmations
  confirmations: parseInt(process.env.CONFIRMATIONS || '5', 10),

  // Polling interval (ms)
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),

  // Log directory
  logDir: process.env.LOG_DIR || './logs/indexer',

  // Chain ID (optional)
  chainId: process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID, 10) : undefined,
};

/**
 * Validate configuration
 * @throws {Error} if configuration is invalid
 */
export function validateConfig() {
  if (!config.rpcUrl) {
    throw new Error('RPC_URL is required in .env file');
  }

  const hasAtLeastOneContract =
    config.contracts.splitter ||
    config.contracts.journeypass ||
    config.contracts.rewardNFT;

  if (!hasAtLeastOneContract) {
    console.warn('⚠️  No contract addresses configured. Indexer will not subscribe to any events.');
  }

  return true;
}

/**
 * Get active contracts
 * @returns {Array} List of active contract configurations
 */
export function getActiveContracts() {
  const active = [];

  if (config.contracts.splitter) {
    active.push({
      name: 'splitter',
      address: config.contracts.splitter,
    });
  }

  if (config.contracts.journeypass) {
    active.push({
      name: 'journeypass',
      address: config.contracts.journeypass,
    });
  }

  if (config.contracts.rewardNFT) {
    active.push({
      name: 'reward',
      address: config.contracts.rewardNFT,
    });
  }

  return active;
}
