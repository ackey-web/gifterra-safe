#!/usr/bin/env node

import 'dotenv/config';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { createPublicClient, createWalletClient, http, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon, polygonAmoy } from 'viem/chains';
import { config, validateConfig } from './config.js';
import {
  initState,
  saveState,
  isProcessed,
  markProcessed,
  createTriggerId,
  addToRetryQueue,
  getRetryableItems,
  removeFromRetryQueue,
  getRetryQueueStatus,
} from './state.js';
import { loadRules, evaluateEvent, getRecipient, getSKU, getTokenId } from './rules.js';
import { initLogger, logDistributionFailure, logRuleEvaluationError, logTransactionError } from './logger.js';

/**
 * GifterraDistributor v1
 *
 * Off-chain worker for automatic NFT distribution
 */

// RewardNFT_v2 ABI (minimal - only functions we need)
const REWARD_NFT_ABI = [
  parseAbiItem('function distributeMintBySku(address to, bytes32 sku, bytes32 triggerId) external returns (uint256)'),
];

// JourneyPass ABI (minimal - for ownerOf)
const JOURNEY_PASS_ABI = [parseAbiItem('function ownerOf(uint256 tokenId) external view returns (address)')];

// State
let publicClient;
let walletClient;
let account;
let isRunning = false;
let lastFileCheck = Date.now();

// Test mode flag
const isTestMode = process.argv.includes('--test');

/**
 * Initialize clients
 */
async function initClients() {
  // Determine chain
  const chain = config.rpcUrl.includes('amoy') ? polygonAmoy : polygon;

  // Create public client
  publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  // Create wallet client
  account = privateKeyToAccount(config.distributorWalletKey);
  walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  });

  console.log(`✅ Initialized clients`);
  console.log(`🔑 Distributor address: ${account.address}`);
}

/**
 * Get latest JSONL files from indexer log directory
 *
 * @returns {Array<string>} Array of file paths
 */
function getLatestJSONLFiles() {
  const files = [];

  if (!statSync(config.indexerLogDir, { throwIfNoEntry: false })) {
    console.warn(`⚠️  Indexer log directory not found: ${config.indexerLogDir}`);
    return files;
  }

  const dirEntries = readdirSync(config.indexerLogDir);

  for (const entry of dirEntries) {
    if (entry.endsWith('.jsonl') && !entry.includes('.error.')) {
      files.push(join(config.indexerLogDir, entry));
    }
  }

  // Sort by modification time (newest first)
  files.sort((a, b) => {
    const statA = statSync(a);
    const statB = statSync(b);
    return statB.mtimeMs - statA.mtimeMs;
  });

  return files;
}

/**
 * Read and process JSONL file
 *
 * @param {string} filePath - File path
 */
function processJSONLFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter((line) => line.trim());

    let processedCount = 0;
    let skippedCount = 0;
    let matchedCount = 0;

    for (const line of lines) {
      try {
        const event = JSON.parse(line);

        // Skip if already processed
        if (isProcessed(event)) {
          skippedCount++;
          continue;
        }

        processedCount++;

        // Evaluate against rules
        const matchedRules = evaluateEvent(event);

        if (matchedRules.length > 0) {
          matchedCount++;
          console.log(`✨ Event matched ${matchedRules.length} rule(s):`, {
            contract: event.contract,
            eventName: event.eventName,
            txHash: event.txHash,
            logIndex: event.logIndex,
          });

          // Process each matched rule
          for (const rule of matchedRules) {
            processMatchedEvent(event, rule).catch((error) => {
              console.error('❌ Failed to process matched event:', error.message);
              logDistributionFailure(event, rule, error, 0);
              addToRetryQueue(event, rule, error.message, 0);
            });
          }
        }

        // Mark as processed
        markProcessed(event);
      } catch (parseError) {
        console.error('⚠️  Failed to parse JSONL line:', parseError.message);
      }
    }

    if (processedCount > 0 || matchedCount > 0) {
      console.log(`📊 Processed ${processedCount} events (${skippedCount} skipped, ${matchedCount} matched)`);
    }
  } catch (error) {
    console.error(`❌ Failed to read JSONL file ${filePath}:`, error.message);
  }
}

/**
 * Process matched event and execute distribution
 *
 * @param {object} event - Event object
 * @param {object} rule - Matched rule
 */
async function processMatchedEvent(event, rule) {
  const action = rule.action;

  if (action.type !== 'reward_mint') {
    console.warn(`⚠️  Unknown action type: ${action.type}`);
    return;
  }

  // Get recipient
  let recipient = getRecipient(event);

  // For FlagUpdated, we need to fetch the token owner
  if (recipient === null && event.eventName === 'FlagUpdated') {
    const tokenId = getTokenId(event);
    if (tokenId !== null) {
      // We need JourneyPass contract address
      // For simplicity, we'll use the event's contract address as a hint
      // In production, you might want to configure this in rules
      const journeyPassAddress = process.env.JOURNEYPASS_ADDRESS;

      if (!journeyPassAddress) {
        throw new Error('JOURNEYPASS_ADDRESS not configured for FlagUpdated event');
      }

      recipient = await publicClient.readContract({
        address: journeyPassAddress,
        abi: JOURNEY_PASS_ABI,
        functionName: 'ownerOf',
        args: [BigInt(tokenId)],
      });

      console.log(`📍 Fetched token owner: ${recipient} (tokenId: ${tokenId})`);
    } else {
      throw new Error('Cannot determine recipient for FlagUpdated event');
    }
  }

  if (!recipient) {
    throw new Error('Cannot determine recipient address');
  }

  // Get SKU
  const sku = getSKU(event, action);

  // Create triggerId
  const triggerId = createTriggerId(event.txHash, event.logIndex);

  console.log(`🎁 Executing distribution:`, {
    recipient,
    sku,
    triggerId,
  });

  // Execute mint with retry logic
  await executeMintWithRetry(recipient, sku, triggerId, event, rule);
}

/**
 * Execute mint transaction with retry logic
 *
 * @param {string} recipient - Recipient address
 * @param {string} sku - SKU (bytes32)
 * @param {string} triggerId - Trigger ID (bytes32)
 * @param {object} event - Original event
 * @param {object} rule - Matched rule
 * @param {number} attempt - Current attempt number
 */
async function executeMintWithRetry(recipient, sku, triggerId, event, rule, attempt = 0) {
  try {
    // Simulate transaction first
    await publicClient.simulateContract({
      address: config.rewardNFTAddress,
      abi: REWARD_NFT_ABI,
      functionName: 'distributeMintBySku',
      args: [recipient, sku, triggerId],
      account,
    });

    // Execute transaction
    const txHash = await walletClient.writeContract({
      address: config.rewardNFTAddress,
      abi: REWARD_NFT_ABI,
      functionName: 'distributeMintBySku',
      args: [recipient, sku, triggerId],
    });

    console.log(`✅ Distribution transaction sent: ${txHash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === 'success') {
      console.log(`🎉 Distribution successful! Block: ${receipt.blockNumber}`);
    } else {
      throw new Error(`Transaction reverted: ${txHash}`);
    }
  } catch (error) {
    console.error(`❌ Distribution failed (attempt ${attempt + 1}/${config.retryMaxAttempts}):`, error.message);

    // Retry if we haven't exceeded max attempts
    if (attempt < config.retryMaxAttempts - 1) {
      const delay = config.retryInitialDelayMs * Math.pow(2, attempt);
      console.log(`⏳ Retrying in ${delay}ms...`);

      await new Promise((resolve) => setTimeout(resolve, delay));
      return executeMintWithRetry(recipient, sku, triggerId, event, rule, attempt + 1);
    } else {
      // Max retries exceeded, log failure
      logDistributionFailure(event, rule, error, attempt + 1);
      throw error;
    }
  }
}

/**
 * Process retry queue
 */
async function processRetryQueue() {
  const retryable = getRetryableItems();

  if (retryable.length === 0) {
    return;
  }

  console.log(`🔄 Processing ${retryable.length} retry queue items...`);

  for (const item of retryable) {
    try {
      await processMatchedEvent(item.event, item.rule);
      removeFromRetryQueue(item);
      console.log(`✅ Retry successful`);
    } catch (error) {
      console.error(`❌ Retry failed:`, error.message);

      // Update retry item
      item.attempts++;

      if (item.attempts >= config.retryMaxAttempts) {
        console.error(`❌ Max retries exceeded, removing from queue`);
        removeFromRetryQueue(item);
        logDistributionFailure(item.event, item.rule, error, item.attempts);
      } else {
        // Update next retry time
        item.nextRetryAt = Date.now() + config.retryInitialDelayMs * Math.pow(2, item.attempts);
      }
    }
  }
}

/**
 * Main polling loop
 */
async function startPolling() {
  console.log('🔄 Starting polling loop...');
  isRunning = true;

  while (isRunning) {
    try {
      // Process latest JSONL files
      const files = getLatestJSONLFiles();

      for (const file of files) {
        processJSONLFile(file);
      }

      // Process retry queue
      await processRetryQueue();

      // Show retry queue status
      const queueStatus = getRetryQueueStatus();
      if (queueStatus.total > 0) {
        console.log(`📋 Retry queue: ${queueStatus.ready}/${queueStatus.total} ready`);
      }

      // Save state periodically
      if (Date.now() - lastFileCheck > 60000) {
        saveState();
        lastFileCheck = Date.now();
      }

      // In test mode, exit after one iteration
      if (isTestMode) {
        console.log('🧪 Test mode: exiting after one iteration');
        break;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
    } catch (error) {
      console.error('❌ Polling error:', error.message);
      await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs * 2));
    }
  }

  console.log('👋 Polling stopped');
}

/**
 * Graceful shutdown
 */
function shutdown() {
  console.log('\n🛑 Shutting down...');
  isRunning = false;
  saveState();
  console.log('💾 State saved');
  process.exit(0);
}

/**
 * Main entry point
 */
async function main() {
  console.log('🚀 GifterraDistributor v1 starting...');

  if (isTestMode) {
    console.log('🧪 Running in TEST mode (process last 100 lines only)');
  }

  try {
    // Validate configuration
    validateConfig();

    // Initialize components
    initLogger();
    initState();
    await initClients();
    loadRules();

    // Setup signal handlers
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Start polling
    await startPolling();

    // Save state on exit (for test mode)
    saveState();
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run
main();
