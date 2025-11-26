/**
 * Web Dashboard Server
 * Provides a web interface to monitor the trading bot
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { trendStore } from './trendAnalyzer.js';
import { randomGif } from './gifs.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.DASHBOARD_PORT || 3000;

// Stats file path
const STATS_FILE = join(__dirname, '../data/stats.json');
const DATA_DIR = join(__dirname, '../data');

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

// Trading enabled state
let tradingEnabled = true;

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
    await sendPositions(socket);
  });
  
  // Handle manual position close
  socket.on('closePosition', async (data) => {
    console.log('Manual close request received:', data);
    
    if (!igApiInstance) {
      socket.emit('closeResult', { success: false, error: 'IG API not initialized' });
      return;
    }
    
    try {
      const result = await igApiInstance.closePosition(
        data.dealId,
        data.epic,
        data.direction,
        data.size
      );
      
      socket.emit('closeResult', { success: result.status === 'success', result });
      
      // Broadcast to all clients
      broadcastTrade({
        epic: data.epic,
        direction: 'CLOSE',
        status: result.status,
        dealReference: result.dealReference,
        dealId: result.dealId,
        message: result.message || 'Manual close via dashboard',
        profit: result.confirmation?.profit || 0,
        timestamp: new Date().toISOString()
      });
      
      // Refresh positions for all clients
      const sockets = await io.fetchSockets();
      for (const s of sockets) {
        await sendPositions(s);
      }
    } catch (error) {
      console.error('Error closing position:', error);
      socket.emit('closeResult', { success: false, error: error.message });
    }
  });
  
  // Handle trading enable/disable toggle
  socket.on('setTradingEnabled', (enabled) => {
    tradingEnabled = enabled;
    console.log(`Trading ${enabled ? 'ENABLED' : 'DISABLED'} via dashboard`);
    
    // Broadcast to all clients
    io.emit('tradingStatusChanged', { enabled: tradingEnabled });
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
  io.emit('signal', event);
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
        symbol: trade.symbol
      });
      console.log(`📅 Tracked position creation: ${trade.dealId} at ${positionsMap.get(trade.dealId).createdDatetime}`);
    }
    // Remove from map when closed
    if (trade.dealId && trade.direction === 'CLOSE') {
      positionsMap.delete(trade.dealId);
      console.log(`📅 Removed closed position from tracking: ${trade.dealId}`);
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
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==========================================`);
    console.log(`Web Dashboard running on:`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  http://YOUR_SERVER_IP:${PORT}`);
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
export function updateServiceStatus(service, online) {
  if (serviceStatus[service]) {
    serviceStatus[service].online = online;
    serviceStatus[service].lastSeen = new Date().toISOString();
    io.emit('serviceStatus', serviceStatus);
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
async function sendPositions(socket) {
  try {
    if (!igApiInstance) {
      socket.emit('positions', []);
      return;
    }
    
    const positions = await igApiInstance.getOpenPositions();
    
    const formatted = positions.map(p => {
      const positionData = positionsMap.get(p.position.dealId);
      return {
        dealId: p.position.dealId,
        epic: p.market.epic,
        instrumentName: p.market.instrumentName,
        direction: p.position.direction,
        size: p.position.size,
        openLevel: p.position.level,
        currentLevel: p.market.bid || p.market.offer || null,
        stopLevel: p.position.stopLevel,
        limitLevel: p.position.limitLevel,
        profit: calculateProfit(p),
        currency: p.position.currency,
        createdDatetime: positionData?.createdDatetime || p.position.createdDateUTC || null
      };
    });
    
    socket.emit('positions', formatted);
  } catch (error) {
    console.error('Error fetching positions for dashboard:', error.message);
    socket.emit('positions', []);
  }
}

// Calculate profit/loss for position
function calculateProfit(position) {
  const { direction, level, size } = position.position;
  const currentPrice = direction === 'BUY' ? position.market.bid : position.market.offer;
  
  if (!currentPrice) return 0;
  
  const priceDiff = direction === 'BUY' ? 
    (currentPrice - level) : 
    (level - currentPrice);
  
  // Simple calculation (real calculation depends on instrument type)
  return parseFloat((priceDiff * size).toFixed(2));
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
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      await sendPositions(socket);
    }
  }, 30 * 1000);
}

export { io, stats };

export function isTradingEnabled() {
  return tradingEnabled;
}
