import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';

/**
 * JSONL Logger
 * Appends events to JSON Lines files (one JSON object per line)
 */

/**
 * Ensure log directory exists
 */
function ensureLogDir() {
  if (!existsSync(config.logDir)) {
    mkdirSync(config.logDir, { recursive: true });
  }
}

/**
 * Get current date string for file naming
 * @returns {string} YYYY-MM-DD format
 */
function getDateString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get log file path
 * @param {string} contract - Contract name (splitter/journeypass/reward)
 * @param {boolean} isError - Whether this is an error log
 * @returns {string} File path
 */
function getLogFilePath(contract, isError = false) {
  const date = getDateString();
  const suffix = isError ? '.error.jsonl' : '.jsonl';
  const filename = `${date}.${contract}${suffix}`;
  return join(config.logDir, filename);
}

/**
 * Write event to JSONL file
 * @param {string} contract - Contract name
 * @param {Object} eventData - Event data to log
 */
export function logEvent(contract, eventData) {
  try {
    ensureLogDir();

    const logEntry = {
      timestamp: new Date().toISOString(),
      ...eventData,
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    const filePath = getLogFilePath(contract);

    appendFileSync(filePath, logLine, 'utf8');

    console.log(`[${contract}] Event logged: Block ${eventData.blockNumber}, Tx ${eventData.txHash.slice(0, 10)}...`);
  } catch (error) {
    console.error(`❌ Failed to write log for ${contract}:`, error.message);
    logError(contract, {
      error: 'LOG_WRITE_FAILED',
      message: error.message,
      eventData,
    });
  }
}

/**
 * Write error to error log file
 * @param {string} contract - Contract name
 * @param {Object} errorData - Error data to log
 */
export function logError(contract, errorData) {
  try {
    ensureLogDir();

    const errorEntry = {
      timestamp: new Date().toISOString(),
      contract,
      ...errorData,
    };

    const errorLine = JSON.stringify(errorEntry) + '\n';
    const filePath = getLogFilePath(contract, true);

    appendFileSync(filePath, errorLine, 'utf8');

    console.error(`[${contract}] Error logged: ${errorData.error}`);
  } catch (error) {
    console.error(`❌ Fatal: Failed to write error log for ${contract}:`, error.message);
  }
}

/**
 * Log raw unparsed event
 * @param {string} contract - Contract name
 * @param {Object} rawLog - Raw log data
 */
export function logRawEvent(contract, rawLog) {
  logError(contract, {
    error: 'ABI_DECODE_FAILED',
    message: 'Failed to decode event, logging raw data',
    rawLog,
  });
}

/**
 * Format common event header
 * @param {Object} log - Raw log from viem
 * @param {number} chainId - Chain ID
 * @param {string} contractName - Contract name
 * @returns {Object} Formatted header
 */
export function formatEventHeader(log, chainId, contractName) {
  return {
    chainId,
    blockNumber: log.blockNumber.toString(),
    txHash: log.transactionHash,
    logIndex: log.logIndex,
    contract: contractName,
  };
}
