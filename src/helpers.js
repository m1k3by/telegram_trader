/**
 * Helper functions for the Telegram Trader
 */

/**
 * Send a notification (placeholder for future webhook/API integration)
 * @param {Object} trend - The trend object
 * @param {string} message - Notification message
 */
export async function sendNotification(trend, message) {
  // TODO: Implement notification system
  // Options:
  // - Send email
  // - Webhook to Discord/Slack
  // - Push notification
  // - SMS via Twilio
  
  console.log(`NOTIFICATION: ${message}`);
}

/**
 * Log trend to a file (simple file-based logging)
 * @param {Object} trend - The trend object
 */
export async function logTrendToFile(trend) {
  // TODO: Implement file logging
  // Could write to JSON file, CSV, or database
  
  console.log(`Logged trend: ${trend.data.symbol} ${trend.data.direction}`);
}

/**
 * Format timestamp in a readable way
 * @param {Date|string} timestamp - The timestamp
 * @returns {string} - Formatted timestamp
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Create a summary report of all trends
 * @param {Array} trends - Array of trend objects
 * @returns {string} - Formatted report
 */
export function createSummaryReport(trends) {
  if (trends.length === 0) {
    return 'No trends to report.';
  }
  
  const lines = [
    '═══════════════════════════════════════',
    '          TREND SUMMARY REPORT         ',
    '═══════════════════════════════════════',
    ''
  ];
  
  const totalTrends = trends.length;
  const buyCount = trends.filter(t => t.data.direction === 'BUY').length;
  const sellCount = trends.filter(t => t.data.direction === 'SELL').length;
  
  lines.push(`Total Trends: ${totalTrends}`);
  lines.push(`Buy Signals: ${buyCount} (${(buyCount/totalTrends*100).toFixed(1)}%)`);
  lines.push(`Sell Signals: ${sellCount} (${(sellCount/totalTrends*100).toFixed(1)}%)`);
  lines.push('');
  
  // Group by symbol
  const bySymbol = trends.reduce((acc, t) => {
    const sym = t.data.symbol || 'UNKNOWN';
    if (!acc[sym]) acc[sym] = [];
    acc[sym].push(t);
    return acc;
  }, {});
  
  lines.push('Trends by Symbol:');
  Object.entries(bySymbol).forEach(([symbol, symbolTrends]) => {
    lines.push(`  ${symbol}: ${symbolTrends.length} signals`);
  });
  
  lines.push('');
  lines.push('═══════════════════════════════════════');
  
  return lines.join('\n');
}

/**
 * Check if a trend meets specific criteria
 * @param {Object} trend - The trend object
 * @param {Object} criteria - Criteria to check
 * @returns {boolean} - True if meets criteria
 */
export function meetsCriteria(trend, criteria = {}) {
  const {
    minRiskReward = 0,
    maxLoss = 100,
    symbols = [],
    directions = []
  } = criteria;
  
  // Check symbol filter
  if (symbols.length > 0 && !symbols.includes(trend.data.symbol)) {
    return false;
  }
  
  // Check direction filter
  if (directions.length > 0 && !directions.includes(trend.data.direction)) {
    return false;
  }
  
  // Check risk/reward ratio
  const potential = calculatePotentialFromTrend(trend);
  if (potential) {
    if (potential.riskRewardRatio < minRiskReward) {
      return false;
    }
    if (parseFloat(potential.potentialLoss) > maxLoss) {
      return false;
    }
  }
  
  return true;
}

/**
 * Calculate potential from trend data
 * @param {Object} trend - The trend object
 * @returns {Object|null} - Calculation result
 */
function calculatePotentialFromTrend(trend) {
  const { price, target, stopLoss, direction } = trend.data;
  
  if (!price || !target || !stopLoss) {
    return null;
  }
  
  let potentialProfit, potentialLoss, riskRewardRatio;
  
  if (direction === 'BUY') {
    potentialProfit = ((target - price) / price) * 100;
    potentialLoss = ((price - stopLoss) / price) * 100;
  } else if (direction === 'SELL') {
    potentialProfit = ((price - target) / price) * 100;
    potentialLoss = ((stopLoss - price) / price) * 100;
  }
  
  if (potentialLoss > 0) {
    riskRewardRatio = potentialProfit / potentialLoss;
  }
  
  return {
    potentialProfit: potentialProfit?.toFixed(2),
    potentialLoss: potentialLoss?.toFixed(2),
    riskRewardRatio: riskRewardRatio?.toFixed(2)
  };
}

/**
 * Export trends to JSON
 * @param {Array} trends - Array of trend objects
 * @returns {string} - JSON string
 */
export function exportToJSON(trends) {
  return JSON.stringify(trends, null, 2);
}

/**
 * Print a nice header
 */
export function printHeader() {
  console.log('\n');
  console.log('======================================================');
  console.log('                                                      ');
  console.log('           TELEGRAM TRADER - LIVE TRENDS              ');
  console.log('                                                      ');
  console.log('======================================================');
  console.log('\n');
}

/**
 * Select the best position from multiple matching positions
 * Strategy: 
 * 1. Filter by compatible direction (for SL/TP updates)
 * 2. Choose position with HIGHEST LOSS (most urgent)
 * @param {Array} positions - Array of matching positions
 * @param {string} instrument - Instrument name for logging
 * @param {Object} context - Optional context (stopLoss, takeProfit, action type)
 * @returns {Object} - Selected position
 */
export function selectBestPosition(positions, instrument, context = {}) {
  if (positions.length === 0) {
    return null;
  }
  
  if (positions.length === 1) {
    console.log(`✅ Single position found for ${instrument}`);
    return positions[0];
  }
  
  console.log(`\n⚠️  MULTIPLE POSITIONS DETECTED: ${positions.length} open positions for ${instrument}`);
  console.log(`📊 Analyzing to select the best candidate...\n`);
  
  // Calculate P&L for each position and log details
  const positionsWithPnL = positions.map((pos, index) => {
    const direction = pos.position.direction;
    const size = pos.position.size;
    const openLevel = pos.position.openLevel || pos.position.level;
    const currentBid = pos.market.bid;
    const currentOffer = pos.market.offer;
    
    // Calculate actual profit based on direction and current market price
    const currentPrice = direction === 'BUY' ? currentBid : currentOffer;
    const priceDiff = direction === 'BUY' ? 
      (currentPrice - openLevel) : 
      (openLevel - currentPrice);
    
    // Calculate profit (simple estimation: price difference * size)
    const calculatedProfit = priceDiff * size;
    
    // Use calculated profit instead of API profit (which is often 0)
    const currentProfit = calculatedProfit;
    const dealId = pos.position.dealId;
    
    console.log(`   Position ${index + 1}:`);
    console.log(`     - Deal ID: ${dealId}`);
    console.log(`     - Direction: ${direction}`);
    console.log(`     - Size: ${size}`);
    console.log(`     - Open Level: ${openLevel}`);
    console.log(`     - Current: Bid ${currentBid} / Offer ${currentOffer}`);
    console.log(`     - P&L: ${currentProfit > 0 ? '+' : ''}${currentProfit.toFixed(2)}€ ${getPnLEmoji(currentProfit)}`);
    
    return {
      position: pos,
      profit: currentProfit,
      direction,
      openLevel,
      currentBid,
      currentOffer,
      index: index + 1
    };
  });
  
  // Filter by compatible direction if SL/TP is provided
  let candidates = positionsWithPnL;
  
  if (context.stopLoss !== undefined) {
    const slLevel = context.stopLoss;
    console.log(`\n🎯 Filtering by SL compatibility (SL: ${slLevel})...`);
    
    // For BUY: SL must be below current price
    // For SELL: SL must be above current price
    const compatible = positionsWithPnL.filter(p => {
      const currentSL = p.position.position.stopLevel;
      
      // Skip if this position already has the requested SL
      if (currentSL === slLevel) {
        console.log(`   ⏭️  Position ${p.index} (${p.direction}): Already has SL ${slLevel} - skipping`);
        return false;
      }
      
      const isCompatible = p.direction === 'BUY' 
        ? slLevel < p.currentBid 
        : slLevel > p.currentOffer;
      
      if (!isCompatible) {
        console.log(`   ❌ Position ${p.index} (${p.direction}): SL ${slLevel} incompatible with ${p.direction} @ ${p.direction === 'BUY' ? p.currentBid : p.currentOffer}`);
      } else {
        console.log(`   ✅ Position ${p.index} (${p.direction}): SL ${slLevel} compatible`);
      }
      
      return isCompatible;
    });
    
    if (compatible.length > 0) {
      candidates = compatible;
      console.log(`\n✅ Filtered to ${candidates.length} compatible position(s)`);
    } else {
      console.log(`\n⚠️  No compatible positions found! Using all positions (manual check required)`);
    }
  }
  
  if (context.takeProfit !== undefined) {
    const tpLevel = context.takeProfit;
    console.log(`\n🎯 Filtering by TP compatibility (TP: ${tpLevel})...`);
    
    // For BUY: TP must be above current price
    // For SELL: TP must be below current price
    const compatible = positionsWithPnL.filter(p => {
      const currentTP = p.position.position.limitLevel;
      
      // Skip if this position already has the requested TP
      if (currentTP === tpLevel) {
        console.log(`   ⏭️  Position ${p.index} (${p.direction}): Already has TP ${tpLevel} - skipping`);
        return false;
      }
      
      const isCompatible = p.direction === 'BUY' 
        ? tpLevel > p.currentOffer 
        : tpLevel < p.currentBid;
      
      if (!isCompatible) {
        console.log(`   ❌ Position ${p.index} (${p.direction}): TP ${tpLevel} incompatible`);
      } else {
        console.log(`   ✅ Position ${p.index} (${p.direction}): TP ${tpLevel} compatible`);
      }
      
      return isCompatible;
    });
    
    if (compatible.length > 0) {
      candidates = compatible;
      console.log(`\n✅ Filtered to ${candidates.length} compatible position(s)`);
    } else {
      console.log(`\n⚠️  No compatible positions found! Using all positions`);
    }
  }
  
  console.log('');
  
  // Sort candidates based on action type
  if (context.action === 'close') {
    // For CLOSE: Select position with HIGHEST profit (most profitable)
    console.log('🎯 Action: CLOSE - Selecting position with highest profit...\n');
    candidates.sort((a, b) => b.profit - a.profit); // Descending = highest profit first
  } else {
    // For SL/TP updates: Select position with HIGHEST loss (most urgent)
    candidates.sort((a, b) => a.profit - b.profit); // Ascending = highest loss first
  }
  
  const selected = candidates[0];
  
  console.log(`🎯 FINAL SELECTION: Position ${selected.index} chosen`);
  console.log(`   Direction: ${selected.direction}`);
  console.log(`   P&L: ${selected.profit > 0 ? '+' : ''}${selected.profit.toFixed(2)}€`);
  
  if (context.action === 'close') {
    console.log(`   Reason: ${selected.profit > 0 ? 'Highest profit - secure gains' : 'Best candidate for closing'}`);
  } else {
    console.log(`   Reason: ${selected.profit < 0 ? 'Highest loss - most urgent' : 'Best candidate based on P&L'}`);
  }
  console.log('');
  
  return selected.position;
}

/**
 * Get emoji based on P&L
 * @param {number} profit - Profit/Loss amount
 * @returns {string} - Emoji
 */
function getPnLEmoji(profit) {
  if (profit > 10) return '🟢 PROFIT';
  if (profit > 0) return '🟡 Small Profit';
  if (profit === 0) return '⚪ Break-even';
  if (profit > -10) return '🟠 Small Loss';
  return '🔴 LOSS';
}
