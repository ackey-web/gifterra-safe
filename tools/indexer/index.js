#!/usr/bin/env node

import { createPublicClient, http, parseAbiItem } from 'viem';
import { config, validateConfig, getActiveContracts } from './config.js';
import { logEvent, logError, logRawEvent, formatEventHeader } from './logger.js';

/**
 * Gifterra Minimal Indexer
 *
 * Subscribes to contract events and logs them to JSONL files
 *
 * Features:
 * - Historical event sync from START_BLOCK
 * - Real-time event subscription with polling
 * - Confirmation-based finality
 * - Duplicate prevention (txHash + logIndex)
 * - Error handling with exponential backoff
 * - JSON Lines output
 */

// ABIs for event parsing
const ABIS = {
  splitter: {
    DonationReceived: parseAbiItem('event DonationReceived(address indexed payer, address indexed token, uint256 amount, bytes32 indexed sku, bytes32 traceId)'),
  },
  journeypass: {
    FlagUpdated: parseAbiItem('event FlagUpdated(uint256 indexed tokenId, uint8 indexed bit, bool value, address indexed operator, bytes32 traceId)'),
    FlagsBatchUpdated: parseAbiItem('event FlagsBatchUpdated(uint256 indexed tokenId, uint256 setMask, uint256 clearMask, address indexed operator, bytes32 traceId)'),
    MetadataUpdate: parseAbiItem('event MetadataUpdate(uint256 tokenId)'),
  },
  reward: {
    TokenMinted: parseAbiItem('event TokenMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint8 distributionType)'),
    AutomaticDistribution: parseAbiItem('event AutomaticDistribution(address indexed distributor, address indexed recipient, uint256 indexed tokenId, bytes32 triggerId)'),
  },
};

// State management
const state = {
  client: null,
  chainId: null,
  lastProcessedBlock: null,
  processedEvents: new Set(), // txHash:logIndex
  isRunning: false,
};

/**
 * Initialize viem client
 */
async function initializeClient() {
  console.log('🚀 Initializing indexer...');

  state.client = createPublicClient({
    transport: http(config.rpcUrl),
  });

  // Get chain ID
  state.chainId = config.chainId || await state.client.getChainId();
  console.log(`🔗 Connected to chain ID: ${state.chainId}`);

  // Get starting block
  if (config.startBlock) {
    state.lastProcessedBlock = config.startBlock;
    console.log(`📍 Starting from block: ${state.lastProcessedBlock}`);
  } else {
    const latestBlock = await state.client.getBlockNumber();
    state.lastProcessedBlock = latestBlock;
    console.log(`📍 Starting from latest block: ${state.lastProcessedBlock}`);
  }
}

/**
 * Check if event is duplicate
 * @param {string} txHash - Transaction hash
 * @param {number} logIndex - Log index
 * @returns {boolean} True if duplicate
 */
function isDuplicate(txHash, logIndex) {
  const key = `${txHash}:${logIndex}`;
  if (state.processedEvents.has(key)) {
    return true;
  }
  state.processedEvents.add(key);
  return false;
}

/**
 * Process Splitter events
 * @param {Array} logs - Raw logs
 */
function processSplitterEvents(logs) {
  for (const log of logs) {
    try {
      if (isDuplicate(log.transactionHash, log.logIndex)) continue;

      const header = formatEventHeader(log, state.chainId, 'splitter');

      // DonationReceived
      if (log.topics[0] === ABIS.splitter.DonationReceived.selector) {
        const { args } = state.client.decodeEventLog({
          abi: [ABIS.splitter.DonationReceived],
          data: log.data,
          topics: log.topics,
        });

        logEvent('splitter', {
          ...header,
          event: 'DonationReceived',
          payer: args.payer,
          token: args.token,
          amount: args.amount.toString(),
          sku: args.sku,
          traceId: args.traceId,
        });
      }
    } catch (error) {
      console.error('❌ Failed to decode splitter event:', error.message);
      logRawEvent('splitter', log);
    }
  }
}

/**
 * Process JourneyPass events
 * @param {Array} logs - Raw logs
 */
function processJourneyPassEvents(logs) {
  for (const log of logs) {
    try {
      if (isDuplicate(log.transactionHash, log.logIndex)) continue;

      const header = formatEventHeader(log, state.chainId, 'journeypass');

      // FlagUpdated
      if (log.topics[0] === ABIS.journeypass.FlagUpdated.selector) {
        const { args } = state.client.decodeEventLog({
          abi: [ABIS.journeypass.FlagUpdated],
          data: log.data,
          topics: log.topics,
        });

        logEvent('journeypass', {
          ...header,
          event: 'FlagUpdated',
          tokenId: args.tokenId.toString(),
          bit: args.bit,
          value: args.value,
          operator: args.operator,
          traceId: args.traceId,
        });
      }
      // FlagsBatchUpdated
      else if (log.topics[0] === ABIS.journeypass.FlagsBatchUpdated.selector) {
        const { args } = state.client.decodeEventLog({
          abi: [ABIS.journeypass.FlagsBatchUpdated],
          data: log.data,
          topics: log.topics,
        });

        logEvent('journeypass', {
          ...header,
          event: 'FlagsBatchUpdated',
          tokenId: args.tokenId.toString(),
          setMask: args.setMask.toString(),
          clearMask: args.clearMask.toString(),
          operator: args.operator,
          traceId: args.traceId,
        });
      }
      // MetadataUpdate (reference only)
      else if (log.topics[0] === ABIS.journeypass.MetadataUpdate.selector) {
        // Optional: log for reference
        console.log(`[journeypass] MetadataUpdate: tokenId ${log.topics[1]}`);
      }
    } catch (error) {
      console.error('❌ Failed to decode journeypass event:', error.message);
      logRawEvent('journeypass', log);
    }
  }
}

/**
 * Process RewardNFT events
 * @param {Array} logs - Raw logs
 */
function processRewardNFTEvents(logs) {
  for (const log of logs) {
    try {
      if (isDuplicate(log.transactionHash, log.logIndex)) continue;

      const header = formatEventHeader(log, state.chainId, 'reward');

      // TokenMinted
      if (log.topics[0] === ABIS.reward.TokenMinted.selector) {
        const { args } = state.client.decodeEventLog({
          abi: [ABIS.reward.TokenMinted],
          data: log.data,
          topics: log.topics,
        });

        logEvent('reward', {
          ...header,
          event: 'TokenMinted',
          to: args.to,
          tokenId: args.tokenId.toString(),
          tokenURI: args.tokenURI,
          distributionType: args.distributionType,
        });
      }
      // AutomaticDistribution
      else if (log.topics[0] === ABIS.reward.AutomaticDistribution.selector) {
        const { args } = state.client.decodeEventLog({
          abi: [ABIS.reward.AutomaticDistribution],
          data: log.data,
          topics: log.topics,
        });

        logEvent('reward', {
          ...header,
          event: 'AutomaticDistribution',
          distributor: args.distributor,
          recipient: args.recipient,
          tokenId: args.tokenId.toString(),
          triggerId: args.triggerId,
        });
      }
    } catch (error) {
      console.error('❌ Failed to decode reward event:', error.message);
      logRawEvent('reward', log);
    }
  }
}

/**
 * Fetch and process events for a block range
 * @param {bigint} fromBlock - Start block
 * @param {bigint} toBlock - End block
 */
async function processBlockRange(fromBlock, toBlock) {
  const activeContracts = getActiveContracts();

  for (const contract of activeContracts) {
    try {
      const logs = await state.client.getLogs({
        address: contract.address,
        fromBlock,
        toBlock,
      });

      if (logs.length > 0) {
        console.log(`📦 Processing ${logs.length} events from ${contract.name} (blocks ${fromBlock}-${toBlock})`);

        if (contract.name === 'splitter') {
          processSplitterEvents(logs);
        } else if (contract.name === 'journeypass') {
          processJourneyPassEvents(logs);
        } else if (contract.name === 'reward') {
          processRewardNFTEvents(logs);
        }
      }
    } catch (error) {
      console.error(`❌ Error fetching logs for ${contract.name}:`, error.message);
      logError(contract.name, {
        error: 'RPC_ERROR',
        message: error.message,
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
      });

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Main polling loop
 */
async function startPolling() {
  console.log('🔄 Starting polling loop...');
  state.isRunning = true;

  while (state.isRunning) {
    try {
      const latestBlock = await state.client.getBlockNumber();
      const confirmedBlock = latestBlock - BigInt(config.confirmations);

      if (confirmedBlock > state.lastProcessedBlock) {
        await processBlockRange(state.lastProcessedBlock + 1n, confirmedBlock);
        state.lastProcessedBlock = confirmedBlock;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
    } catch (error) {
      console.error('❌ Polling error:', error.message);
      // Backoff and retry
      await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs * 2));
    }
  }
}

/**
 * Run once mode (for testing)
 * @param {number} blockRange - Number of blocks to process
 */
async function runOnce(blockRange = 100) {
  console.log(`🔍 Running once mode (last ${blockRange} blocks)`);

  const latestBlock = await state.client.getBlockNumber();
  const fromBlock = latestBlock - BigInt(blockRange);

  await processBlockRange(fromBlock, latestBlock);

  console.log('✅ Once mode completed');
  process.exit(0);
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Validate configuration
    validateConfig();

    // Initialize client
    await initializeClient();

    // Check for --once flag
    const isOnceMode = process.argv.includes('--once');

    if (isOnceMode) {
      await runOnce();
    } else {
      // Start polling
      await startPolling();
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down gracefully...');
  state.isRunning = false;
  process.exit(0);
});

// Start indexer
main();
