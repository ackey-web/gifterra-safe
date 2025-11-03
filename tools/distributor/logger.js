import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';

/**
 * Logger for GifterraDistributor
 *
 * Logs errors and failed distribution attempts to JSONL files
 */

/**
 * Get date string for log file rotation (YYYY-MM-DD)
 *
 * @returns {string} Date string
 */
function getDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get log file path
 *
 * @returns {string} Log file path
 */
function getLogFilePath() {
  const date = getDateString();
  const filename = `${date}.distributor.error.jsonl`;
  return join(config.errorLogDir, filename);
}

/**
 * Initialize logger
 */
export function initLogger() {
  // Ensure log directory exists
  if (!existsSync(config.errorLogDir)) {
    mkdirSync(config.errorLogDir, { recursive: true });
  }
}

/**
 * Log error to JSONL file
 *
 * @param {object} error - Error details
 */
export function logError(error) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...error,
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    appendFileSync(getLogFilePath(), logLine, 'utf8');
  } catch (err) {
    console.error('❌ Failed to write error log:', err.message);
  }
}

/**
 * Log distribution failure
 *
 * @param {object} event - Original event
 * @param {object} rule - Matched rule
 * @param {string} error - Error message
 * @param {number} attempts - Number of attempts made
 */
export function logDistributionFailure(event, rule, error, attempts) {
  logError({
    type: 'distribution_failure',
    event: {
      contract: event.contract,
      eventName: event.eventName,
      txHash: event.txHash,
      logIndex: event.logIndex,
      blockNumber: event.blockNumber,
    },
    rule: {
      trigger: rule.trigger,
      action: rule.action,
    },
    error: error instanceof Error ? error.message : String(error),
    attempts,
  });
}

/**
 * Log rule evaluation error
 *
 * @param {object} event - Original event
 * @param {string} error - Error message
 */
export function logRuleEvaluationError(event, error) {
  logError({
    type: 'rule_evaluation_error',
    event: {
      contract: event.contract,
      eventName: event.eventName,
      txHash: event.txHash,
      logIndex: event.logIndex,
    },
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Log transaction error
 *
 * @param {string} txHash - Transaction hash (if available)
 * @param {string} error - Error message
 * @param {object} context - Additional context
 */
export function logTransactionError(txHash, error, context = {}) {
  logError({
    type: 'transaction_error',
    txHash,
    error: error instanceof Error ? error.message : String(error),
    context,
  });
}

/**
 * Log general error
 *
 * @param {string} message - Error message
 * @param {object} context - Additional context
 */
export function logGeneralError(message, context = {}) {
  logError({
    type: 'general_error',
    message,
    context,
  });
}
