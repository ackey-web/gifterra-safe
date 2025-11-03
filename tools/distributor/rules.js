import { readFileSync } from 'fs';
import { config } from './config.js';

/**
 * Rule Evaluation Engine for GifterraDistributor
 *
 * Rule structure:
 * {
 *   "trigger": "DonationReceived" | "FlagUpdated",
 *   "match": {
 *     // For DonationReceived:
 *     "sku": "0x...", (optional)
 *     "token": "0x...", (optional)
 *     "minAmount": "1000000000000000", (optional, in wei)
 *     "traceId": "0x...", (optional)
 *
 *     // For FlagUpdated:
 *     "bit": 0, (optional)
 *     "value": true, (optional)
 *     "traceId": "0x...", (optional)
 *   },
 *   "action": {
 *     "type": "reward_mint",
 *     "sku": "0x...", (optional, overrides trigger sku)
 *     "tokenURIOverride": "ipfs://..." (optional)
 *   }
 * }
 */

let rules = [];

/**
 * Load rules from rules.json
 */
export function loadRules() {
  try {
    const data = readFileSync(config.rulesPath, 'utf8');
    rules = JSON.parse(data);
    console.log(`✅ Loaded ${rules.length} rules from ${config.rulesPath}`);
    return rules;
  } catch (error) {
    console.error(`❌ Failed to load rules from ${config.rulesPath}:`, error.message);
    throw error;
  }
}

/**
 * Evaluate event against all rules
 *
 * @param {object} event - Event object from JSONL
 * @returns {Array} Matched rules
 */
export function evaluateEvent(event) {
  const matches = [];

  for (const rule of rules) {
    if (matchesRule(event, rule)) {
      matches.push(rule);
    }
  }

  return matches;
}

/**
 * Check if event matches a rule
 *
 * @param {object} event - Event object from JSONL
 * @param {object} rule - Rule object
 * @returns {boolean} True if event matches rule
 */
function matchesRule(event, rule) {
  // Check trigger type
  if (event.eventName !== rule.trigger) {
    return false;
  }

  // Evaluate match conditions
  const match = rule.match || {};

  if (event.eventName === 'DonationReceived') {
    return matchDonationReceived(event, match);
  } else if (event.eventName === 'FlagUpdated') {
    return matchFlagUpdated(event, match);
  }

  return false;
}

/**
 * Match DonationReceived event
 *
 * @param {object} event - Event object
 * @param {object} match - Match conditions
 * @returns {boolean} True if matches
 */
function matchDonationReceived(event, match) {
  const args = event.args;

  // Match SKU (if specified)
  if (match.sku !== undefined && args.sku !== match.sku) {
    return false;
  }

  // Match token (if specified)
  if (match.token !== undefined && args.token !== match.token) {
    return false;
  }

  // Match minAmount (if specified)
  if (match.minAmount !== undefined) {
    const eventAmount = BigInt(args.amount);
    const minAmount = BigInt(match.minAmount);
    if (eventAmount < minAmount) {
      return false;
    }
  }

  // Match traceId (if specified)
  if (match.traceId !== undefined && args.traceId !== match.traceId) {
    return false;
  }

  return true;
}

/**
 * Match FlagUpdated event
 *
 * @param {object} event - Event object
 * @param {object} match - Match conditions
 * @returns {boolean} True if matches
 */
function matchFlagUpdated(event, match) {
  const args = event.args;

  // Match bit (if specified)
  if (match.bit !== undefined && args.bit !== match.bit) {
    return false;
  }

  // Match value (if specified)
  if (match.value !== undefined && args.value !== match.value) {
    return false;
  }

  // Match traceId (if specified)
  if (match.traceId !== undefined && args.traceId !== match.traceId) {
    return false;
  }

  return true;
}

/**
 * Get recipient address from event
 *
 * @param {object} event - Event object
 * @returns {string} Recipient address
 */
export function getRecipient(event) {
  if (event.eventName === 'DonationReceived') {
    return event.args.payer;
  } else if (event.eventName === 'FlagUpdated') {
    // For FlagUpdated, we need to fetch the token owner from chain
    // This will be handled in the main logic
    return null; // Signal that we need to fetch from chain
  }

  return null;
}

/**
 * Get SKU from event or action override
 *
 * @param {object} event - Event object
 * @param {object} action - Action object
 * @returns {string} SKU (bytes32)
 */
export function getSKU(event, action) {
  // Action override takes precedence
  if (action.sku) {
    return action.sku;
  }

  // Fall back to event SKU (if available)
  if (event.eventName === 'DonationReceived' && event.args.sku) {
    return event.args.sku;
  }

  // Default to empty bytes32
  return '0x0000000000000000000000000000000000000000000000000000000000000000';
}

/**
 * Get token ID from FlagUpdated event
 *
 * @param {object} event - Event object
 * @returns {string|null} Token ID
 */
export function getTokenId(event) {
  if (event.eventName === 'FlagUpdated' && event.args.tokenId) {
    return event.args.tokenId;
  }
  return null;
}
