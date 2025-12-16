import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const TRADES_FILE = path.join(DATA_DIR, 'trades.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure trades file exists
if (!fs.existsSync(TRADES_FILE)) {
  fs.writeFileSync(TRADES_FILE, JSON.stringify({}, null, 2));
}

/**
 * Load all trades from storage
 * @returns {Object} Map of dealId -> tradeData
 */
export function loadTrades() {
  try {
    const data = fs.readFileSync(TRADES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading trades:', error.message);
    return {};
  }
}

/**
 * Save a trade to storage
 * @param {string} dealId - The deal ID from IG
 * @param {Object} tradeData - The trade details (epic, contractSize, etc.)
 */
export function saveTrade(dealId, tradeData) {
  try {
    const trades = loadTrades();
    trades[dealId] = {
      ...tradeData,
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));
    console.log(`💾 Trade saved: ${dealId}`);
  } catch (error) {
    console.error('❌ Error saving trade:', error.message);
  }
}

/**
 * Get a trade by deal ID
 * @param {string} dealId 
 * @returns {Object|null}
 */
export function getTrade(dealId) {
  const trades = loadTrades();
  return trades[dealId] || null;
}

/**
 * Update an existing trade
 * @param {string} dealId 
 * @param {Object} updates 
 */
export function updateTrade(dealId, updates) {
  try {
    const trades = loadTrades();
    if (trades[dealId]) {
      trades[dealId] = {
        ...trades[dealId],
        ...updates,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));
      console.log(`💾 Trade updated: ${dealId}`);
    } else {
      console.warn(`⚠️ Trade not found for update: ${dealId}`);
    }
  } catch (error) {
    console.error('❌ Error updating trade:', error.message);
  }
}
