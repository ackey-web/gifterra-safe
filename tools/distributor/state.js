import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';

/**
 * State Manager for GifterraDistributor
 *
 * Manages:
 * - Processed events (idempotency)
 * - File read positions
 * - Retry queue
 */

const STATE_FILE = join(config.stateDir, 'processed.json');

// In-memory state
let processedEvents = new Set();
let filePositions = {};
let retryQueue = [];

/**
 * Initialize state from disk
 */
export function initState() {
  // Ensure state directory exists
  if (!existsSync(config.stateDir)) {
    mkdirSync(config.stateDir, { recursive: true });
  }

  // Load processed events
  if (existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
      processedEvents = new Set(data.processedEvents || []);
      filePositions = data.filePositions || {};
      console.log(`✅ Loaded ${processedEvents.size} processed events from state`);
    } catch (error) {
      console.error('⚠️  Failed to load state file, starting fresh:', error.message);
    }
  }
}

/**
 * Save state to disk
 */
export function saveState() {
  try {
    const data = {
      processedEvents: Array.from(processedEvents),
      filePositions,
      lastSaved: new Date().toISOString(),
    };
    writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('❌ Failed to save state:', error.message);
  }
}

/**
 * Generate idempotency key from event
 *
 * @param {object} event - Event object from JSONL
 * @returns {string} Idempotency key (txHash:logIndex)
 */
export function getIdempotencyKey(event) {
  return `${event.txHash}:${event.logIndex}`;
}

/**
 * Check if event has been processed
 *
 * @param {object} event - Event object from JSONL
 * @returns {boolean} True if already processed
 */
export function isProcessed(event) {
  const key = getIdempotencyKey(event);
  return processedEvents.has(key);
}

/**
 * Mark event as processed
 *
 * @param {object} event - Event object from JSONL
 */
export function markProcessed(event) {
  const key = getIdempotencyKey(event);
  processedEvents.add(key);

  // Save state every 10 events to avoid excessive I/O
  if (processedEvents.size % 10 === 0) {
    saveState();
  }
}

/**
 * Get file read position
 *
 * @param {string} filePath - File path
 * @returns {number} Read position (line number)
 */
export function getFilePosition(filePath) {
  return filePositions[filePath] || 0;
}

/**
 * Update file read position
 *
 * @param {string} filePath - File path
 * @param {number} position - New position (line number)
 */
export function updateFilePosition(filePath, position) {
  filePositions[filePath] = position;
}

/**
 * Add failed event to retry queue
 *
 * @param {object} event - Event object
 * @param {object} rule - Matched rule
 * @param {string} error - Error message
 * @param {number} attempts - Current attempt count
 */
export function addToRetryQueue(event, rule, error, attempts = 0) {
  retryQueue.push({
    event,
    rule,
    error,
    attempts,
    nextRetryAt: Date.now() + config.retryInitialDelayMs * Math.pow(2, attempts),
  });
}

/**
 * Get retry queue items ready for retry
 *
 * @returns {Array} Items ready for retry
 */
export function getRetryableItems() {
  const now = Date.now();
  return retryQueue.filter((item) => item.nextRetryAt <= now);
}

/**
 * Remove item from retry queue
 *
 * @param {object} item - Retry queue item
 */
export function removeFromRetryQueue(item) {
  const index = retryQueue.indexOf(item);
  if (index > -1) {
    retryQueue.splice(index, 1);
  }
}

/**
 * Get retry queue status
 *
 * @returns {object} Queue status
 */
export function getRetryQueueStatus() {
  return {
    total: retryQueue.length,
    ready: getRetryableItems().length,
  };
}

/**
 * Convert txHash + logIndex to bytes32 triggerId
 *
 * Simple strategy: Take first 16 bytes of txHash + 2 bytes of logIndex (padded)
 *
 * @param {string} txHash - Transaction hash (0x...)
 * @param {number} logIndex - Log index
 * @returns {string} bytes32 triggerId
 */
export function createTriggerId(txHash, logIndex) {
  // Remove 0x prefix
  const hash = txHash.startsWith('0x') ? txHash.slice(2) : txHash;

  // Take first 32 bytes of txHash (64 hex chars)
  // For simplicity, we use the full txHash (32 bytes)
  // In production, you might want a more sophisticated strategy

  // Pad logIndex to 2 bytes (4 hex chars)
  const indexHex = logIndex.toString(16).padStart(4, '0');

  // Combine: first 30 bytes of txHash + 2 bytes of logIndex
  const combined = hash.slice(0, 60) + indexHex;

  return '0x' + combined.padEnd(64, '0');
}
