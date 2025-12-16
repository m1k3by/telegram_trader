/**
 * Web Dashboard Server
 * Provides a web interface to monitor the trading bot
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getExchangeRateToEURCached } from './exchangeRates.js';
import { trendStore } from './trendAnalyzer.js';
import { loadTrades } from './tradeStorage.js';
import { randomGif } from './gifs.js';
import { calculateContractSize } from './contractHelper.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Cache for market details to avoid API spam
// Map<epic, { data: object, timestamp: number }>
const marketDetailsCache = new Map();
const CACHE_TTL = 60000; // 1 minute cache for static details, but we need fresh prices!

// Stats file path
const STATS_FILE = join(__dirname, '../data/stats.json');
const DATA_DIR = join(__dirname, '../data');
const CONFIG_FILE = join(__dirname, '../data/config.json');

// Load config from file or create default
function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(data);
      console.log('📂 Config loaded:', config);
      return config;
    }
  } catch (error) {
    console.warn('⚠️ Could not load config.json:', error.message);
  }
  
  // Default config
  const defaultConfig = {
    tradingEnabled: true,
    riskPerTrade: 100
  };
  
  // Save default config immediately
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf8');
    console.log('💾 Created default config.json with 100€ risk');
  } catch (error) {
    console.warn('⚠️ Could not save default config:', error.message);
  }
  
  return defaultConfig;
}

// Save config to file
function saveConfig() {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    const configData = {
      tradingEnabled: tradingEnabled,
      riskPerTrade: riskPerTrade
    };
    writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 2), 'utf8');
    console.log('💾 Config saved:', configData);
  } catch (error) {
    console.error('❌ Error saving config:', error.message);
  }
}

// Load stats from file or create new
function loadStats() {
  try {
    if (existsSync(STATS_FILE)) {
      const data = JSON.parse(readFileSync(STATS_FILE, 'utf8'));
      console.log('📊 Loaded stats from file');
      return data;
    }
  } catch (error) {
    console.error('Error loading stats:', error.message);
  }
  
  return {
    totalSignals: 0,
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    totalProfit: 0,
    totalLoss: 0,
    netProfit: 0,
    startTime: new Date().toISOString()
  };
}

// Save stats to file
function saveStats() {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving stats:', error.message);
  }
}

// Store recent events for dashboard
let recentEvents = [];
let stats = loadStats();

// Map to track position creation dates: dealId -> createdDatetime
let positionsMap = new Map();

// Update startTime to current bot start (not from file)
stats.startTime = new Date().toISOString();
console.log(`📊 Bot started at: ${stats.startTime}`);
console.log(`📊 Current stats: Trades: ${stats.totalTrades}, Profit: ${stats.netProfit.toFixed(2)}€`);

// Service status tracking
let serviceStatus = {
  telegram: {
    online: false,
    lastSeen: null
  },
  igMarkets: {
    online: false,
    lastSeen: null
  }
};

// Reference to IG API (will be set by index.js)
let igApiInstance = null;

// Load config
const config = loadConfig();

// Trading enabled state
let tradingEnabled = config.tradingEnabled;
let riskPerTrade = config.riskPerTrade;

// Serve static files
app.use(express.static(join(__dirname, '../public')));

// API Endpoints
app.get('/api/stats', (req, res) => {
  const trends = trendStore.getAll();
  res.json({
    ...stats,
    trends: trends.length,
    recentTrends: trends.slice(-10),
    uptime: Date.now() - new Date(stats.startTime).getTime()
  });
});

app.get('/api/events', (req, res) => {
  res.json(recentEvents.slice(-50));
});

app.get('/api/trends', (req, res) => {
  res.json(trendStore.getAll());
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('Dashboard client connected');
  
  // Send current stats on connect
  socket.emit('stats', stats);
  
  // Send current config values
  socket.emit('tradingStatusChanged', { enabled: tradingEnabled });
  socket.emit('riskPerTradeChanged', { risk: riskPerTrade });
  
  // Send history on connect
  updateAndBroadcastHistory(socket);
  
  // Send account info on connect
  broadcastAccountInfo(socket);

  // Prepare events for this client: retroactively attach win GIF for recent positive closes
    try {
    const eventsForClient = recentEvents.slice(-50).map(ev => {
      if (ev && ev.type === 'trade' && ev.data) {
        try {
          let p = ev.data.profit;
          if (typeof p === 'string') p = parseFloat(p.replace(/[€$,]/g, ''));
          if (!isNaN(p) && ev.data.direction === 'CLOSE' && p > 0 && !ev.data.gifUrl) {
            // create a shallow copy to avoid mutating stored recentEvents
            const copied = { ...ev, data: { ...ev.data, gifUrl: randomGif() } };
            return copied;
          }
        } catch (e) {
          // ignore
        }
      }
      return ev;
    });

    socket.emit('events', eventsForClient.slice(-20));
  } catch (e) {
    socket.emit('events', recentEvents.slice(-20));
  }
  socket.emit('serviceStatus', serviceStatus);
  
  // Send server stats
  sendServerStats(socket);
  
  // Handle position requests
  socket.on('requestPositions', async () => {
    await updateAndBroadcastPositions(socket);
  });
  
  // Handle closed positions requests
  socket.on('requestClosedPositions', async () => {
    await updateAndBroadcastHistory(socket);
  });
  
  // Send initial closed positions
  // updateAndBroadcastHistory(socket); // Already called on connection
  
  // Handle manual position close
  socket.on('closePosition', async (data) => {
    console.log('Manual close request received:', data);
    
    if (!igApiInstance) {
      socket.emit('closeResult', { success: false, error: 'IG API not initialized' });
      return;
    }
    
    try {
      // Snapshot position data BEFORE closing
      const posData = positionsMap.get(data.dealId);
      const positionSnapshot = {
        openLevel: posData?.openLevel,
        stopLevel: posData?.stopLevel,
        limitLevel: posData?.limitLevel,
        epic: posData?.epic || data.epic,
        symbol: posData?.symbol,
        createdAt: posData?.createdDatetime,
        size: posData?.size || data.size,
        direction: posData?.direction || data.direction,
        riskAmount: posData?.riskAmount
      };
      
      console.log('Position snapshot before close:', positionSnapshot);
      
      const result = await igApiInstance.closePosition(
        data.dealId,
        data.epic,
        data.direction,
        data.size,
        posData?.currency || data.currency // Pass currency to avoid extra API call
      );
      
      socket.emit('closeResult', { success: result.status === 'success', result });
      
      // Broadcast to all clients with complete data
      broadcastTrade({
        epic: positionSnapshot.epic,
        symbol: positionSnapshot.symbol,
        direction: 'CLOSE',
        originalDirection: positionSnapshot.direction,
        status: result.status,
        dealReference: result.dealReference,
        dealId: result.dealId,
        message: result.message || 'Manual close via dashboard',
        profit: result.confirmation?.profit || 0,
        level: positionSnapshot.openLevel,
        closeLevel: result.confirmation?.level,
        stopLevel: positionSnapshot.stopLevel,
        limitLevel: positionSnapshot.limitLevel,
        size: positionSnapshot.size,
        riskAmount: positionSnapshot.riskAmount,
        createdAt: positionSnapshot.createdAt,
        closeReason: 'Manual',
        timestamp: new Date().toISOString()
      });
      
      // Refresh positions for all clients
      await updateAndBroadcastPositions();
    } catch (error) {
      console.error('Error closing position:', error);
      socket.emit('closeResult', { success: false, error: error.message });
    }
  });
  
  // Handle trading enable/disable toggle
  socket.on('setTradingEnabled', (enabled) => {
    tradingEnabled = enabled;
    console.log(`Trading ${enabled ? 'ENABLED' : 'DISABLED'} via dashboard`);
    
    // Save to config file
    saveConfig();
    
    // Broadcast to all clients
    if (io) io.emit('tradingStatusChanged', { enabled: tradingEnabled });
  });
  
  // Handle risk per trade change
  socket.on('setRiskPerTrade', (risk) => {
    riskPerTrade = parseFloat(risk) || 50;
    console.log(`Risk per trade set to ${riskPerTrade}€`);
    
    // Save to config file
    saveConfig();
    
    // Broadcast to all clients
    if (io) io.emit('riskPerTradeChanged', { risk: riskPerTrade });
  });
  
  socket.on('disconnect', () => {
    console.log('Dashboard client disconnected');
  });
});

// Functions to broadcast events
export function broadcastSignal(signal) {
  const event = {
    type: 'signal',
    timestamp: new Date().toISOString(),
    data: signal
  };
  
  recentEvents.push(event);
  if (recentEvents.length > 100) recentEvents.shift();
  
  stats.totalSignals++;
  saveStats();
  if (io) io.emit('signal', event);
}

export function broadcastTrade(trade) {
  const event = {
    type: 'trade',
    timestamp: new Date().toISOString(),
    data: trade
  };
  
  recentEvents.push(event);
  if (recentEvents.length > 100) recentEvents.shift();
  
  stats.totalTrades++;
  if (trade.status === 'success') {
    stats.successfulTrades++;
    // Track position creation date if dealId exists and direction is not CLOSE
    if (trade.dealId && trade.direction !== 'CLOSE' && trade.direction !== 'SL_UPDATE' && trade.direction !== 'TP_UPDATE') {
      positionsMap.set(trade.dealId, {
        createdDatetime: trade.timestamp || new Date().toISOString(),
        epic: trade.epic,
        symbol: trade.symbol,
        instrumentName: trade.symbol,
        openLevel: trade.level,
        stopLevel: trade.stopLevel,
        limitLevel: trade.limitLevel,
        size: trade.size,
        direction: trade.direction,
        riskAmount: trade.riskAmount,
        lastKnownPrice: trade.level // Initialize with entry price
      });
      console.log(`📅 Tracked position creation: ${trade.dealId} at ${positionsMap.get(trade.dealId).createdDatetime}`);
    }
    // Update stopLevel or limitLevel if it's an update
    if (trade.dealId && trade.direction === 'SL_UPDATE' && trade.stopLevel !== undefined) {
      const posData = positionsMap.get(trade.dealId);
      if (posData) {
        posData.stopLevel = trade.stopLevel;
        positionsMap.set(trade.dealId, posData);
        console.log(`📊 Updated stopLevel for ${trade.dealId}: ${trade.stopLevel}`);
      }
    }
    if (trade.dealId && trade.direction === 'TP_UPDATE' && trade.limitLevel !== undefined) {
      const posData = positionsMap.get(trade.dealId);
      if (posData) {
        posData.limitLevel = trade.limitLevel;
        positionsMap.set(trade.dealId, posData);
        console.log(`📊 Updated limitLevel for ${trade.dealId}: ${trade.limitLevel}`);
      }
    }
    // Remove from map when closed
    if (trade.dealId && trade.direction === 'CLOSE') {
      positionsMap.delete(trade.dealId);
      console.log(`📅 Removed closed position from tracking: ${trade.dealId}`);
      
      // Refresh history
      updateAndBroadcastHistory();
    }
  } else if (trade.status === 'error') {
    stats.failedTrades++;
  }
  
  // Track profit/loss if available
  if (trade.profit !== undefined && trade.profit !== null) {
    // Parse profit value (could be string like "-5.75€" or number -5.75)
    let profitValue = trade.profit;
    if (typeof profitValue === 'string') {
      // Remove currency symbols and parse
      profitValue = parseFloat(profitValue.replace(/[€$,]/g, ''));
    }
    
    if (!isNaN(profitValue)) {
      if (profitValue > 0) {
        stats.totalProfit += profitValue;
      } else if (profitValue < 0) {
        stats.totalLoss += Math.abs(profitValue);
      }
      stats.netProfit = stats.totalProfit - stats.totalLoss;
      
      console.log(`📊 Stats updated: Profit ${profitValue.toFixed(2)}€ | Total: +${stats.totalProfit.toFixed(2)}€ / -${stats.totalLoss.toFixed(2)}€ | Net: ${stats.netProfit.toFixed(2)}€`);
    }

  // If this is a closed position with positive profit, attach a small win GIF URL
  try {
    let _profit = trade.profit;
    if (typeof _profit === 'string') _profit = parseFloat(_profit.replace(/[€$,]/g, ''));
    if (!isNaN(_profit) && trade.direction === 'CLOSE' && _profit > 0) {
      trade.gifUrl = randomGif();
    }
  } catch (e) {
    // ignore parsing errors
  }
  }
  
  saveStats();
  io.emit('trade', event);
  io.emit('stats', stats);
  
  // Broadcast updated closed positions if this was a close
  if (trade.direction === 'CLOSE') {
    updateAndBroadcastHistory();
  }
}

export function broadcastStatus(message, type = 'info') {
  const event = {
    type: 'status',
    level: type,
    timestamp: new Date().toISOString(),
    message
  };
  
  recentEvents.push(event);
  if (recentEvents.length > 100) recentEvents.shift();
  
  io.emit('status', event);
}

// Start dashboard server
export function startDashboard() {
  const port = process.env.DASHBOARD_PORT || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`\n==========================================`);
    console.log(`Web Dashboard running on:`);
    console.log(`  http://localhost:${port}`);
    console.log(`  http://46.62.162.38:${port}`);
    console.log(`==========================================\n`);
  });
  
  // Start background tasks
  startBackgroundTasks();
}

// Set IG API reference
export function setIgApi(igApi) {
  igApiInstance = igApi;
}

// Update service status
// Helper to get cached market details
async function getCachedMarketDetails(epic, forceRefresh = false) {
  const now = Date.now();
  const cached = marketDetailsCache.get(epic);
  
  if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }
  
  if (!igApiInstance) return null;
  
  try {
    const details = await igApiInstance.getMarketDetails(epic).catch(() => null);
    if (details) {
      marketDetailsCache.set(epic, { data: details, timestamp: now });
    }
    return details;
  } catch (e) {
    return cached ? cached.data : null; // Fallback to stale cache if API fails
  }
}

export function updateServiceStatus(service, online) {
  if (serviceStatus[service]) {
    serviceStatus[service].online = online;
    serviceStatus[service].lastSeen = new Date().toISOString();
    if (io) io.emit('serviceStatus', serviceStatus);
  }
}

// Send server statistics
function sendServerStats(socket) {
  const cpuUsage = Math.round(os.loadavg()[0] * 100 / os.cpus().length);
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const ramUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);
  
  const serverStats = {
    cpu: Math.min(cpuUsage, 100),
    ram: ramUsage,
    uptime: Math.floor(os.uptime() / 60) // minutes
  };
  
  socket.emit('serverStats', serverStats);
}

// Send positions from IG Markets
async function updateAndBroadcastPositions(specificSocket = null) {
  try {
    if (!igApiInstance) {
      console.log('⚠️ Dashboard: IG API instance not ready');
      const emptyData = { positions: [], margin: { used: 0, available: 0, total: 0 } };
      if (specificSocket) {
          specificSocket.emit('positions', []);
          specificSocket.emit('margin', emptyData.margin);
      } else {
          io.emit('positions', []);
          io.emit('margin', emptyData.margin);
      }
      return;
    }
    
    // 1. Get Raw Positions
    const positions = await igApiInstance.getOpenPositions();
    
    if (!positions || positions.length === 0) {
      const emptyData = { positions: [], margin: { used: 0, available: 0, total: 0 } };
      
      // Still try to get account info even if no positions
      try {
        const accountInfo = await igApiInstance.getAccountInfo();
        emptyData.margin = { 
          used: accountInfo.deposit || 0, 
          available: accountInfo.available || 0, 
          total: accountInfo.balance || 0 
        };
      } catch (e) {
        // ignore
      }
      
      if (specificSocket) {
          specificSocket.emit('positions', []);
          specificSocket.emit('margin', emptyData.margin);
      } else {
          io.emit('positions', []);
          io.emit('margin', emptyData.margin);
      }
      return;
    }

    // 2. Get Account Info
    let accountInfo = { balance: 0, deposit: 0, available: 0 };
    try {
      accountInfo = await igApiInstance.getAccountInfo();
    } catch (e) {
      console.error('❌ Dashboard: Failed to get account info:', e.message);
    }

    // 3. Process Each Position
    const formatted = await Promise.all(positions.map(async (p) => {
      try {
        const dealId = p.position.dealId;
        const epic = p.market.epic;
        const instrument = p.market.instrumentName;
        const size = p.position.size;
        const direction = p.position.direction; // BUY / SELL
        const entry = p.position.level;
        const apiProfit = p.position.profit !== undefined ? p.position.profit : null;

        // Try to get live price from market snapshot
        // USE CACHE HERE but force refresh if price is missing from position
        let currentPrice = p.market.bid || p.market.offer || null;
        
        // If position data doesn't have price, we MUST fetch fresh market details
        // The cache might be too old (up to 60s), so force refresh if we need price
        let marketDetails = await getCachedMarketDetails(epic, !currentPrice); 

        if (!currentPrice && marketDetails) {
          currentPrice = marketDetails.bid || marketDetails.offer || marketDetails.closePrice || null;
          if (currentPrice) {
              // console.log(`   💰 Fetched fresh price for ${epic}: ${currentPrice}`);
          }
        }

        // If still no price, try to calculate from Net Change (Fallback for missing Bid/Offer)
        if (!currentPrice && p.market.netChange && p.market.percentageChange && p.market.percentageChange !== 0) {
             try {
                 // Formula: PrevClose = (NetChange * 100) / PercentageChange
                 // Current = PrevClose + NetChange
                 const prevClose = (p.market.netChange * 100) / p.market.percentageChange;
                 const calculatedPrice = prevClose + p.market.netChange;
                 
                 // Sanity check: ensure calculated price is positive
                 if (calculatedPrice > 0) {
                    currentPrice = calculatedPrice;
                 }
             } catch (e) {
                 // ignore calculation error
             }
        }

        // If still no price, fetch last minute candle
        if (!currentPrice) {
          const candles = await igApiInstance.getPrices(epic, 'MINUTE', 60).catch(() => []);
          if (candles && candles.length > 0) {
            const last = candles[candles.length - 1];
            currentPrice = (last.closePrice && (last.closePrice.bid || last.closePrice.ask || last.closePrice.lastTraded)) || null;
          }
        }

        // Fallback if price is still missing (e.g. API 403)
        let isStale = false;
        if (currentPrice === null) {
            currentPrice = entry; // Use entry price so we can at least show something
            isStale = true;
        }

        // Determine contractSize and marginFactor
        let contractSize = 1;
        let marginFactor = 0.05; // fallback 5%
        if (marketDetails) {
          // Use smart calculation for contract size
          const calculatedSize = calculateContractSize(marketDetails);
          if (calculatedSize !== null) {
              contractSize = calculatedSize;
          } else {
              // Fallback logic if calculateContractSize returns null
              if (epic.includes('GOLD') || epic.includes('SILVER')) contractSize = 1;
              else if (epic.includes('MINI')) contractSize = 10000;
              else if (epic.includes('CFD') || epic.includes('STANDARD')) contractSize = 100000;
          }
          
          if (marketDetails.marginFactor) marginFactor = (Number(marketDetails.marginFactor) || marginFactor) / 100;
          else if (marketDetails.marginDepositBands && marketDetails.marginDepositBands[0]) marginFactor = (marketDetails.marginDepositBands[0].margin || marginFactor * 100) / 100;
        }

        // Use API-provided P&L if present
        let profitEUR = null;
        // IG API returns profit in ACCOUNT currency (EUR) usually, but sometimes in quote currency?
        // Actually, p.position.profit is usually in account currency.
        // But let's check p.position.currency - that is the instrument currency (e.g. USD for Tesla)
        // Wait, if p.position.profit is undefined (as seen in debug), we MUST calculate manually.
        
        if (apiProfit !== null && apiProfit !== undefined) {
          profitEUR = Number(apiProfit);
        } else if (currentPrice !== null) {
          // calculate manually in quote currency then convert to EUR if needed
          const multiplier = direction === 'BUY' ? 1 : -1; // for SELL profit = (open - current)
          const profitInQuote = (currentPrice - entry) * multiplier * Number(size) * contractSize;

          // convert to EUR if position currency differs
          const quoteCurrency = p.position.currency || marketDetails?.currencyCode || 'EUR';
          let exch = 1.0;
          if (quoteCurrency && quoteCurrency !== 'EUR') {
            exch = await getExchangeRateToEURCached(quoteCurrency).catch(() => 1.0);
          }
          profitEUR = profitInQuote * exch;
        }

        // margin calculation (approx)
        let marginValue = null;
        // Use current price if available, otherwise fallback to open level (entry price)
        const calculationPrice = currentPrice !== null ? currentPrice : entry;

        if (calculationPrice !== null) {
          marginValue = calculationPrice * Number(size) * contractSize * marginFactor;
          // convert to EUR if needed
          const quoteCurrency = p.position.currency || marketDetails?.currencyCode || 'EUR';
          if (quoteCurrency && quoteCurrency !== 'EUR') {
            const exch = await getExchangeRateToEURCached(quoteCurrency).catch(() => 1.0);
            marginValue = marginValue * exch;
          }
        }
        
        // Calculate profit percent
        let profitPercent = "N/A";
        if (profitEUR !== null && marginValue !== null && marginValue !== 0) {
            profitPercent = ((profitEUR / marginValue) * 100).toFixed(2);
        }

        return {
          dealId: dealId,
          epic: epic,
          instrumentName: instrument,
          direction: direction,
          size: size,
          openLevel: entry,
          currentLevel: currentPrice !== null ? currentPrice : "N/A",
          limitLevel: p.position.limitLevel,
          stopLevel: p.position.stopLevel,
          profit: profitEUR !== null ? parseFloat(profitEUR.toFixed(2)) : "N/A",
          profitPercent: profitPercent,
          margin: marginValue !== null ? parseFloat(marginValue.toFixed(2)) : "N/A",
          riskAmount: null,
          currency: p.position.currency,
          createdDatetime: p.position.createdDateUTC,
          isStale: isStale
        };
        
      } catch (err) {
        // Log full stack to find root cause (was reporting 'riskAmount is not defined')
        console.error(`❌ Error processing position ${p.market.epic}:`, err && err.stack ? err.stack : err);
        return {
          dealId: p.position.dealId,
          epic: p.market.epic,
          instrumentName: p.market.instrumentName || "Unknown Instrument",
          direction: p.position.direction,
          size: p.position.size,
          openLevel: p.position.level,
          currentLevel: "N/A",
          profit: "N/A",
          margin: "N/A",
          currency: p.position.currency,
          error: err.message,
          createdDatetime: p.position.createdDateUTC
        };
      }
    }));
    
    const marginData = { 
      used: accountInfo.deposit || 0, 
      available: accountInfo.available || 0, 
      total: accountInfo.balance || 0 
    };

    if (specificSocket) {
        specificSocket.emit('positions', formatted);
        specificSocket.emit('margin', marginData);
    } else {
        io.emit('positions', formatted);
        io.emit('margin', marginData);
    }
    
  } catch (error) {
    console.error('❌ Error sending positions:', error && error.stack ? error.stack : error);
    if (specificSocket) specificSocket.emit('positions', []);
    else io.emit('positions', []);
  }
}

/**
 * Extract quote currency from instrument name
 * Examples: "GBP/JPY" → "JPY", "EUR/USD" → "USD", "Gold" → null
 */
function extractQuoteCurrency(instrumentName) {
  // Check for FOREX pairs with "/" separator
  if (instrumentName.includes('/')) {
    const parts = instrumentName.split('/');
    if (parts.length === 2) {
      // Return second part (quote currency), remove " Mini" suffix if present
      return parts[1].trim().replace(/\s+Mini$/i, '').replace(/\s+Kassa$/i, '');
    }
  }
  return null; // Not a FOREX pair, return null
}

// Send transaction history from IG Markets
async function updateAndBroadcastHistory(specificSocket = null) {
  try {
    if (!igApiInstance) {
      // If API not ready, send empty array but use 'closedPositions' event name to match frontend
      if (specificSocket) specificSocket.emit('closedPositions', []);
      else io.emit('closedPositions', []);
      return;
    }
    
    // User requested to use /history/activity with specific parameters
    const toDate = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Last 30 days
    
    //console.log(`Fetching account activity and transactions from ${fromDate} to ${toDate}...`);
    
    // Fetch Activity (Events)
    const activityPromise = igApiInstance.getAccountActivity({
        from: fromDate,
        to: toDate,
        detailed: true,
        pageSize: 200 // Increased to ensure we find recent trades
    });

    // Fetch Transactions (Financials)
    const transactionsPromise = igApiInstance.getTransactionHistory({
        from: fromDate,
        to: toDate,
        pageSize: 200 // Increased to ensure matching
    });

    const [activityData, transactionData] = await Promise.all([activityPromise, transactionsPromise]);
    
    let transactions = [];
    if (activityData && activityData.activities) {
        // Sort all activities by date descending (Newest first)
        // Include EDITS to capture SL/TP changes
        const allActivities = activityData.activities
            .filter(a => (a.type === 'POSITION' || a.type === 'EDIT') && a.status === 'ACCEPTED')
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        const processedOpens = new Set(); // Keep track of opens we've matched

        for (const activity of allActivities) {
            const isClose = activity.description.includes('geschlossen') || activity.description.includes('Closed');
            
            if (isClose) {
                // It's a Close event. Let's look for its Open partner in the *remaining* (older) items.
                let matchingOpen = null;
                
                // Look ahead for the first matching OPEN that hasn't been used
                for (let i = allActivities.indexOf(activity) + 1; i < allActivities.length; i++) {
                    const candidate = allActivities[i];
                    const isCandidateOpen = candidate.description.includes('eröffnet') || candidate.description.includes('Opened');
                    
                    // Match by EPIC and ensure it's an Open event
                    if (isCandidateOpen && candidate.epic === activity.epic && !processedOpens.has(candidate.dealId)) {
                        matchingOpen = candidate;
                        processedOpens.add(candidate.dealId);
                        break;
                    }
                }

                // Find latest SL/TP from Open or subsequent Edits
                let stopLevel = matchingOpen ? matchingOpen.details.stopLevel : null;
                let limitLevel = matchingOpen ? matchingOpen.details.limitLevel : null;
                
                if (matchingOpen) {
                    // Look for EDITS for this dealId (Open Deal ID)
                    // Edits usually reference the Open Deal ID
                    const edits = allActivities.filter(e => 
                       e.dealId === matchingOpen.dealId && 
                       (e.type === 'EDIT' || e.description.includes('Änderung') || e.description.includes('Edit')) &&
                       new Date(e.date) > new Date(matchingOpen.date) &&
                       new Date(e.date) < new Date(activity.date)
                    );
                    
                    // Sort edits by date ascending (apply in order)
                    edits.sort((a, b) => new Date(a.date) - new Date(b.date));
                    
                    edits.forEach(e => {
                        if (e.details.stopLevel) stopLevel = e.details.stopLevel;
                        if (e.details.limitLevel) limitLevel = e.details.limitLevel;
                    });
                }

                // Try to find matching financial transaction for P&L
                let financialProfit = null;
                if (transactionData && transactionData.length > 0) {
                    const match = transactionData.find(t => 
                        activity.dealId.endsWith(t.reference) && 
                        t.transactionType === 'TRADE'
                    );
                    
                    if (match && match.profitAndLoss) {
                        const pnlStr = match.profitAndLoss.replace(/^[A-Z]+/, '');
                        financialProfit = parseFloat(pnlStr);
                    }
                }

                transactions.push({
                    instrumentName: activity.details.marketName,
                    epic: activity.epic,
                    size: activity.details.size,
                    direction: matchingOpen ? matchingOpen.details.direction : activity.details.direction, // Use Open direction (e.g. BUY)
                    openLevel: matchingOpen ? matchingOpen.details.level : null,
                    level: activity.details.level, // Close Level
                    profitAndLoss: financialProfit !== null ? financialProfit : (activity.details.profitAndLoss || null),
                    stop: stopLevel || activity.details.stopLevel, // Use tracked SL or fallback to Close SL
                    limit: limitLevel || activity.details.limitLevel, // Use tracked TP or fallback to Close TP
                    dateUtc: matchingOpen ? matchingOpen.date : null, // Created At
                    closedAt: activity.date, // Closed At
                    dealId: activity.dealId, // Closing Deal ID
                    openDealId: matchingOpen ? matchingOpen.dealId : null,
                    transactionType: 'CLOSE' // Mark as a completed trade
                });
            }
        }
    }
    
    // Sort by Close Date Descending
    transactions.sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));

    // Limit to 30 items
    transactions = transactions.slice(0, 30);
    
    const formatted = transactions.map(t => {
        // Parse profit string if present
        let profit = 0;
        if (typeof t.profitAndLoss === 'number') {
            profit = t.profitAndLoss;
        } else if (t.profitAndLoss) {
             if (typeof t.profitAndLoss === 'string') {
                 const match = t.profitAndLoss.match(/[-+]?[\d,.]+/);
                 if (match) profit = parseFloat(match[0].replace(',', '.'));
             } else {
                 profit = t.profitAndLoss;
             }
        }

        // Calculate Margin (Approximate)
        let marginValue = null;
        if (t.openLevel && t.size) {
            // Heuristic for Contract Size
            let contractSize = 1;
            if (t.epic.includes('MINI')) contractSize = 10000; // Forex Mini
            else if (t.epic.includes('CFD') || t.epic.includes('STANDARD')) contractSize = 100000; // Forex Standard
            else if (t.epic.includes('GOLD') || t.epic.includes('SILVER')) contractSize = 1; // Commodities often 1 or 100
            
            // Heuristic for Margin Factor
            let marginFactor = 0.05; // Default 5% (1:20)
            if (t.epic.includes('CASH') || t.epic.includes('SHARES')) marginFactor = 0.20; // Stocks 20%
            else if (t.epic.includes('IX.')) marginFactor = 0.05; // Indices 5%
            
            // Calculate: Price * Size * ContractSize * MarginFactor
            marginValue = t.openLevel * t.size * contractSize * marginFactor;
        }
        
        return {
            instrumentName: t.instrumentName,
            symbol: t.instrumentName,
            epic: t.epic,
            direction: t.direction,
            size: t.size,
            openLevel: t.openLevel,
            closeLevel: t.level,
            profit: profit,
            stopLevel: t.stop,   // Fixed: was t.stopLevel which is undefined in 't'
            limitLevel: t.limit, // Fixed: was t.limitLevel which is undefined in 't'
            riskAmount: marginValue, // Mapped to "Margin (€)" column
            createdDatetime: t.dateUtc,
            closedAt: t.closedAt,
            dealId: t.dealId,
            openDealId: t.openDealId,
            type: t.transactionType
        };
    });
    
    if (specificSocket) {
      specificSocket.emit('closedPositions', formatted);
    } else {
      io.emit('closedPositions', formatted);
    }
    
  } catch (error) {
    console.error('Error broadcasting history:', error.message);
    if (specificSocket) specificSocket.emit('closedPositions', []);
    else io.emit('closedPositions', []);
  }
}

// Broadcast account info (Balance, Margin, etc.)
async function broadcastAccountInfo(specificSocket = null) {
  if (!igApiInstance) return;

  try {
    const accountInfo = await igApiInstance.getAccountInfo();
    
    if (specificSocket) {
      specificSocket.emit('accountInfo', accountInfo);
    } else {
      io.emit('accountInfo', accountInfo);
    }
  } catch (error) {
    console.error('Error broadcasting account info:', error.message);
  }
}

// Background tasks
function startBackgroundTasks() {
  // Broadcast server stats every 5 minutes
  setInterval(async () => {
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      sendServerStats(socket);
    }
  }, 5 * 60 * 1000);
  
  // Broadcast service status (alive check) every 5 minutes
  setInterval(() => {
    io.emit('serviceStatus', serviceStatus);
  }, 5 * 60 * 1000);
  
  // Auto-refresh positions every 30 seconds for all connected clients
  setInterval(async () => {
    await updateAndBroadcastPositions();
    await updateAndBroadcastHistory();
    await broadcastAccountInfo();
  }, 30 * 1000);
  
  // Monitor for automatic position closes (SL/TP hits) every 15 seconds
  setInterval(async () => {
    if (!igApiInstance) return;
    
    try {
      // Get current open positions from IG
      const openPositions = await igApiInstance.getOpenPositions();
      const openDealIds = new Set(openPositions.map(p => p.position.dealId));
      
      // Check each tracked position
      for (const [dealId, posData] of positionsMap.entries()) {
        // If position is in our map but NOT in IG's open positions = automatically closed
        if (!openDealIds.has(dealId)) {
          console.log(`🔔 Detected automatic position close: ${dealId}`);
          
          // Try to get deal history to find close details
          try {
            const activity = await igApiInstance.getAccountActivity();
            const closeActivity = activity.activities?.find(a => 
              a.dealId === dealId && 
              a.type === 'POSITION' && 
              a.status === 'ACCEPTED' &&
              a.actionStatus === 'CLOSED'
            );
            
            const closeReason = closeActivity?.stopLevel ? 'SL' : 
                              closeActivity?.limitLevel ? 'TP' : 
                              'Auto';
            
            const profit = closeActivity?.profit?.amount || 0;
            const closeLevel = closeActivity?.level;
            
            console.log(`📊 Close details: Reason=${closeReason}, Profit=${profit}, Level=${closeLevel}`);
            
            // Broadcast the automatic close
            broadcastTrade({
              epic: posData.epic,
              symbol: posData.symbol,
              direction: 'CLOSE',
              originalDirection: posData.direction,
              status: 'success',
              dealId: dealId,
              message: `Position automatically closed (${closeReason})`,
              profit: profit,
              level: posData.openLevel,
              closeLevel: closeLevel || posData.openLevel,
              stopLevel: posData.stopLevel,
              limitLevel: posData.limitLevel,
              size: posData.size,
              riskAmount: posData.riskAmount,
              closeReason: closeReason,
              timestamp: new Date().toISOString()
            });
            
          } catch (activityError) {
            console.log(`⚠️ Could not fetch close details: ${activityError.message}`);
            
            // Broadcast without full details
            broadcastTrade({
              epic: posData.epic,
              symbol: posData.symbol,
              direction: 'CLOSE',
              originalDirection: posData.direction,
              status: 'success',
              dealId: dealId,
              message: 'Position automatically closed',
              profit: 0,
              level: posData.openLevel,
              closeLevel: posData.openLevel,
              stopLevel: posData.stopLevel,
              limitLevel: posData.limitLevel,
              size: posData.size,
              riskAmount: posData.riskAmount,
              closeReason: 'Auto',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in position monitor:', error.message);
    }
  }, 15 * 1000); // Check every 15 seconds
}

export { io, stats };

export function isTradingEnabled() {
  return tradingEnabled;
}

export function getRiskPerTrade() {
  return riskPerTrade;
}
