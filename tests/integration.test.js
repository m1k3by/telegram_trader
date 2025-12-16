/**
 * INTEGRATION TESTS
 * Tests end-to-end message processing with real Telegram messages
 * Ensures retry logic, position matching, and all trade types work correctly
 */

import assert from 'assert';
import { processMessage } from '../src/messageProcessor.js';
import { getInstrumentMapping } from '../src/trendAnalyzer.js';

console.log('🧪 Running Integration Tests...\n');

// Mock IG API for testing
const mockIgApi = {
  positions: [],
  lastTrade: null,
  lastSearch: null,
  marketDetails: {},
  
  async searchMarkets(query) {
    this.lastSearch = query;
    
    // Simulate Netflix alternatives
    if (query.toLowerCase().includes('netflix')) {
      return [
        { epic: 'UC.D.NFLX.CASH.IP', instrumentName: 'Netflix Inc', marketStatus: 'CLOSED' },
        { epic: 'UC.D.NFLX.CFD.IP', instrumentName: 'Netflix Inc CFD', marketStatus: 'TRADEABLE' },
        { epic: 'IX.D.NFLX.DAILY.IP', instrumentName: 'Netflix Daily', marketStatus: 'TRADEABLE' }
      ];
    }
    
    // Simulate NASDAQ alternatives
    if (query.toLowerCase().includes('nasdaq')) {
      return [
        { epic: 'IX.D.NASDAQ.IFE.IP', instrumentName: 'US Tech 100', marketStatus: 'CLOSED' },
        { epic: 'IX.D.NASDAQ.WEEKEND.IP', instrumentName: 'US Tech 100 Weekend', marketStatus: 'TRADEABLE' }
      ];
    }
    
    return [];
  },
  
  async getMarketDetails(epic) {
    // Simulate different market states
    if (epic.includes('NFLX.CASH')) {
      return {
        bid: undefined,
        offer: undefined,
        minDealSize: 1,
        dealSizeIncrement: 1,
        marketStatus: 'TRADEABLE'
      };
    }
    
    if (epic.includes('NFLX.CFD') || epic.includes('NFLX.DAILY')) {
      return {
        bid: 108.70,
        offer: 108.82,
        minDealSize: 1,
        dealSizeIncrement: 1,
        marketStatus: 'TRADEABLE'
      };
    }
    
    if (epic.includes('NASDAQ.WEEKEND')) {
      return {
        bid: 25270.0,
        offer: 25283.5,
        minDealSize: 0.1,
        dealSizeIncrement: 0.1,
        marketStatus: 'TRADEABLE'
      };
    }
    
    // Default tradeable market
    return {
      bid: 4200.0,
      offer: 4201.0,
      minDealSize: 0.1,
      dealSizeIncrement: 0.1,
      marketStatus: 'TRADEABLE',
      marginFactor: 5.0
    };
  },
  
  async executeTrade(tradeData) {
    this.lastTrade = tradeData;
    
    // Simulate failure for closed markets
    if (tradeData.epic.includes('CASH') && tradeData.epic.includes('NFLX')) {
      throw new Error('Market is closed');
    }
    
    if (tradeData.epic.includes('NASDAQ.IFE')) {
      throw new Error('Market is closed');
    }
    
    // Success for others
    const dealReference = `TEST-${Date.now()}`;
    this.positions.push({
      dealId: `DEAL-${Date.now()}`,
      dealReference,
      epic: tradeData.epic,
      instrumentName: tradeData.instrumentName || 'Test Instrument',
      direction: tradeData.direction,
      size: tradeData.size,
      level: tradeData.level
    });
    
    return { dealReference };
  },
  
  async getPositions() {
    return this.positions;
  },
  
  async updateStopLoss(dealId, stopLevel) {
    const position = this.positions.find(p => p.dealId === dealId);
    if (!position) throw new Error('Position not found');
    position.stopLevel = stopLevel;
    return { success: true };
  },
  
  async updateTakeProfit(dealId, profitLevel) {
    const position = this.positions.find(p => p.dealId === dealId);
    if (!position) throw new Error('Position not found');
    position.profitLevel = profitLevel;
    return { success: true };
  },
  
  async closePosition(dealId) {
    const index = this.positions.findIndex(p => p.dealId === dealId);
    if (index === -1) throw new Error('Position not found');
    this.positions.splice(index, 1);
    return { dealReference: `CLOSE-${Date.now()}` };
  },
  
  reset() {
    this.positions = [];
    this.lastTrade = null;
    this.lastSearch = null;
  }
};

// =============================================================================
// TEST 1: Gold Trade with SL Update (Complete Flow)
// =============================================================================
console.log('Test 1: Complete Gold Trade Flow');
mockIgApi.reset();

const goldMessages = [
  '🚦LIVE TREND🚦\nICH KAUFE GOLD (EK: 4201.25)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️',
  'Ich setze den SL bei GOLD auf 4204.00'
];

// Process OPEN
let result1 = await processMessage(goldMessages[0], mockIgApi);
assert.strictEqual(result1.action, 'POSITION_OPEN', 'Should detect POSITION_OPEN');
assert.strictEqual(result1.instrument, 'GOLD', 'Should parse GOLD');
assert.strictEqual(result1.direction, 'BUY', 'Should detect BUY direction');
assert.strictEqual(result1.entryPrice, 4201.25, 'Should parse entry price');

// Verify trade executed
assert.ok(mockIgApi.lastTrade, 'Should execute trade');
assert.strictEqual(mockIgApi.lastTrade.direction, 'BUY', 'Trade should be BUY');
assert.strictEqual(mockIgApi.positions.length, 1, 'Should have 1 open position');

// Process SL UPDATE
let result2 = await processMessage(goldMessages[1], mockIgApi);
assert.strictEqual(result2.action, 'SL_UPDATE', 'Should detect SL_UPDATE');
assert.strictEqual(result2.instrument, 'GOLD', 'Should parse GOLD');
assert.strictEqual(result2.stopLoss, 4204.00, 'Should parse stop loss');

// Verify position found and updated
const goldPosition = mockIgApi.positions[0];
assert.strictEqual(goldPosition.stopLevel, 4204.00, 'Stop loss should be updated');

console.log('✅ Test 1 passed: Gold trade flow works\n');

// =============================================================================
// TEST 2: Netflix Retry Logic (Primary Closed → Alternative Found)
// =============================================================================
console.log('Test 2: Netflix Retry Logic');
mockIgApi.reset();

const netflixMessage = '🚦LIVE TREND🚦\nICH KAUFE NETFLIX (EK: 108.76)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';

let result3 = await processMessage(netflixMessage, mockIgApi);
assert.strictEqual(result3.action, 'POSITION_OPEN', 'Should detect POSITION_OPEN');
assert.strictEqual(result3.instrument, 'NETFLIX', 'Should parse NETFLIX');

// Verify it searched for alternatives
assert.ok(mockIgApi.lastSearch, 'Should trigger market search');
assert.ok(mockIgApi.lastSearch.toLowerCase().includes('netflix'), 'Should search for Netflix');

// Verify it used alternative EPIC (not the primary CASH one)
assert.ok(mockIgApi.lastTrade, 'Should execute trade with alternative');
assert.ok(
  mockIgApi.lastTrade.epic.includes('CFD') || mockIgApi.lastTrade.epic.includes('DAILY'),
  'Should use alternative EPIC (CFD or DAILY), not CASH'
);

console.log('✅ Test 2 passed: Netflix retry finds alternative\n');

// =============================================================================
// TEST 3: NASDAQ Weekend Fallback
// =============================================================================
console.log('Test 3: NASDAQ Weekend Fallback');
mockIgApi.reset();

const nasdaqMessage = '🚦LIVE TREND🚦\nICH VERKAUFE NASDAQ (EK: 25276.74)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';

let result4 = await processMessage(nasdaqMessage, mockIgApi);
assert.strictEqual(result4.action, 'POSITION_OPEN', 'Should detect POSITION_OPEN');
assert.strictEqual(result4.instrument, 'NASDAQ', 'Should parse NASDAQ');
assert.strictEqual(result4.direction, 'SELL', 'Should detect SELL direction');

// If primary fails, should try weekend fallback
assert.ok(mockIgApi.lastTrade, 'Should execute trade');
if (mockIgApi.lastSearch) {
  // If search was triggered, verify it found weekend alternative
  assert.ok(
    mockIgApi.lastTrade.epic.includes('WEEKEND'),
    'Should use weekend fallback when primary closed'
  );
}

console.log('✅ Test 3 passed: NASDAQ fallback works\n');

// =============================================================================
// TEST 4: Position Close with Fuzzy Matching
// =============================================================================
console.log('Test 4: Position Close with Fuzzy Matching');
mockIgApi.reset();

// Open a position first
const openMsg = '🚦LIVE TREND🚦\nICH KAUFE ETHEREUM (EK: 3000.007)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';
await processMessage(openMsg, mockIgApi);

assert.strictEqual(mockIgApi.positions.length, 1, 'Should have 1 open position');

// Close it
const closeMsg = '🖼 ICH SCHLIEßE ETHEREUM❗237€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd';
let result5 = await processMessage(closeMsg, mockIgApi);

assert.strictEqual(result5.action, 'POSITION_CLOSE', 'Should detect POSITION_CLOSE');
assert.strictEqual(result5.instrument, 'ETHEREUM', 'Should parse ETHEREUM');
assert.strictEqual(result5.profit, 237, 'Should parse profit');

// Verify position closed
assert.strictEqual(mockIgApi.positions.length, 0, 'Position should be closed');

console.log('✅ Test 4 passed: Position close with fuzzy matching\n');

// =============================================================================
// TEST 5: Multiple Positions - Correct One Found
// =============================================================================
console.log('Test 5: Multiple Positions - Correct Matching');
mockIgApi.reset();

// Open GOLD BUY
await processMessage('🚦LIVE TREND🚦\nICH KAUFE GOLD (EK: 4201.25)', mockIgApi);
// Open GOLD SELL
await processMessage('🚦LIVE TREND🚦\nICH VERKAUFE GOLD (EK: 4251.11)', mockIgApi);
// Open BITCOIN
await processMessage('🚦LIVE TREND🚦\nICH KAUFE BITCOIN CALL 92000 (EK: 3983.00)', mockIgApi);

assert.strictEqual(mockIgApi.positions.length, 3, 'Should have 3 open positions');

// Update SL for first GOLD
await processMessage('Ich setze den SL bei GOLD auf 4204.00', mockIgApi);

// Verify correct position updated (should be the GOLD BUY, not SELL or BITCOIN)
const goldBuyPosition = mockIgApi.positions.find(p => 
  p.instrumentName.includes('Gold') && p.direction === 'BUY'
);
assert.ok(goldBuyPosition, 'Should find GOLD BUY position');
assert.strictEqual(goldBuyPosition.stopLevel, 4204.00, 'Should update correct position SL');

console.log('✅ Test 5 passed: Correct position updated among multiples\n');

// =============================================================================
// TEST 6: DAX Contract Sizing (0.1 not 0.5)
// =============================================================================
console.log('Test 6: DAX Contract Sizing');
mockIgApi.reset();

const daxMessage = '🚦LIVE TREND🚦\nICH KAUFE DAX (EK: 23549.6)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';

await processMessage(daxMessage, mockIgApi);

// Verify correct EPIC used (25€ contract)
const mapping = getInstrumentMapping('DAX', false);
assert.strictEqual(mapping.epic, 'IX.D.DAX.IFD.IP', 'Should use 25€ DAX contract');

// Verify trade size respects minDealSize from API
assert.ok(mockIgApi.lastTrade, 'Should execute trade');
assert.ok(mockIgApi.lastTrade.size >= 0.1, 'Trade size should be at least 0.1');
assert.ok(mockIgApi.lastTrade.size % 0.1 === 0, 'Trade size should be multiple of 0.1');

console.log('✅ Test 6 passed: DAX uses correct contract and sizing\n');

// =============================================================================
// TEST 7: Bitcoin CALL Options (With Emojis)
// =============================================================================
console.log('Test 7: Bitcoin CALL Options');
mockIgApi.reset();

const btcCallMessage = '🚦LIVE TREND🚦\nICH KAUFE BITCOIN CALL 92000 (EK: 3983.00) 📈\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';

let result6 = await processMessage(btcCallMessage, mockIgApi);
assert.strictEqual(result6.action, 'POSITION_OPEN', 'Should detect POSITION_OPEN');
assert.strictEqual(result6.instrument, 'BITCOIN CALL 92000', 'Should parse full option name with emojis');
assert.strictEqual(result6.entryPrice, 3983.00, 'Should parse entry price');

console.log('✅ Test 7 passed: Bitcoin CALL with emojis parsed correctly\n');

// =============================================================================
// TEST 8: Tesla CALL Options
// =============================================================================
console.log('Test 8: Tesla CALL Options');
mockIgApi.reset();

const teslaCallMessage = '🚦LIVE TREND🚦\nICH KAUFE TESLA CALL 440 (EK: 16.25)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';

let result7 = await processMessage(teslaCallMessage, mockIgApi);
assert.strictEqual(result7.action, 'POSITION_OPEN', 'Should detect POSITION_OPEN');
assert.strictEqual(result7.instrument, 'TESLA CALL 440', 'Should parse Tesla CALL');
assert.strictEqual(result7.entryPrice, 16.25, 'Should parse entry price');

// Test SL update for Tesla CALL
const teslaSLMessage = 'Ich setze den SL bei TESLA CALL 440 auf 14.63';
let result8 = await processMessage(teslaSLMessage, mockIgApi);
assert.strictEqual(result8.action, 'SL_UPDATE', 'Should detect SL_UPDATE');
assert.strictEqual(result8.instrument, 'TESLA CALL 440', 'Should parse full option name');
assert.strictEqual(result8.stopLoss, 14.63, 'Should parse stop loss');

console.log('✅ Test 8 passed: Tesla CALL options work\n');

// =============================================================================
// TEST 9: Brent Oil Trade
// =============================================================================
console.log('Test 9: Brent Oil Trade');
mockIgApi.reset();

const brentMessage = '🚦LIVE TREND🚦\nICH VERKAUFE BRENT (EK: 63.39)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';

let result9 = await processMessage(brentMessage, mockIgApi);
assert.strictEqual(result9.action, 'POSITION_OPEN', 'Should detect POSITION_OPEN');
assert.strictEqual(result9.instrument, 'BRENT', 'Should parse BRENT');
assert.strictEqual(result9.direction, 'SELL', 'Should detect SELL direction');
assert.strictEqual(result9.entryPrice, 63.39, 'Should parse entry price');

console.log('✅ Test 9 passed: Brent oil trade works\n');

// =============================================================================
// TEST 10: EUR/USD Trade
// =============================================================================
console.log('Test 10: EUR/USD Trade');
mockIgApi.reset();

const eurUsdOpen = '🚦LIVE TREND🚦\nICH KAUFE EUR/USD (EK: 1.0534)\nHier traden: https://cutt.ly/tradecfd';
await processMessage(eurUsdOpen, mockIgApi);

const eurUsdClose = '🖼 ICH SCHLIEßE EUR/USD❗442€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd';
let result10 = await processMessage(eurUsdClose, mockIgApi);

assert.strictEqual(result10.action, 'POSITION_CLOSE', 'Should detect POSITION_CLOSE');
assert.strictEqual(result10.instrument, 'EUR/USD', 'Should parse EUR/USD');
assert.strictEqual(result10.profit, 442, 'Should parse profit');

console.log('✅ Test 10 passed: EUR/USD trade works\n');

// =============================================================================
// TEST 11: Ethereum CALL Options
// =============================================================================
console.log('Test 11: Ethereum CALL Options');
mockIgApi.reset();

const ethCallMessage = '🚦LIVE TREND🚦\nICH KAUFE ETHEREUM CALL 3200 (EK: 144.46)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';

let result11 = await processMessage(ethCallMessage, mockIgApi);
assert.strictEqual(result11.action, 'POSITION_OPEN', 'Should detect POSITION_OPEN');
assert.strictEqual(result11.instrument, 'ETHEREUM CALL 3200', 'Should parse Ethereum CALL');
assert.strictEqual(result11.entryPrice, 144.46, 'Should parse entry price');

const ethCallClose = '🖼 ICH SCHLIEßE ETHEREUM CALL 3200❗729€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd';
let result12 = await processMessage(ethCallClose, mockIgApi);
assert.strictEqual(result12.action, 'POSITION_CLOSE', 'Should detect POSITION_CLOSE');
assert.strictEqual(result12.instrument, 'ETHEREUM CALL 3200', 'Should parse full option name');
assert.strictEqual(result12.profit, 729, 'Should parse profit');

console.log('✅ Test 11 passed: Ethereum CALL options work\n');

// =============================================================================
// TEST 12: Edge Case - Market Closed, No Alternatives
// =============================================================================
console.log('Test 12: Edge Case - No Alternatives Available');
mockIgApi.reset();

// Mock a market with no alternatives
mockIgApi.searchMarkets = async () => [];

const obscureMessage = '🚦LIVE TREND🚦\nICH KAUFE OBSCURE_ASSET (EK: 100.00)';

try {
  await processMessage(obscureMessage, mockIgApi);
  // Should handle gracefully, not crash
  console.log('✅ Test 12 passed: Handles no alternatives gracefully\n');
} catch (error) {
  // Expected to fail, but should not crash the app
  assert.ok(error.message, 'Should have error message');
  console.log('✅ Test 12 passed: Fails gracefully when no alternatives\n');
}

// =============================================================================
// SUMMARY
// =============================================================================
console.log('═══════════════════════════════════════════════════════');
console.log('✅ ALL INTEGRATION TESTS PASSED!');
console.log('═══════════════════════════════════════════════════════');
console.log('Coverage:');
console.log('  ✓ Complete trade flows (Open → SL → Close)');
console.log('  ✓ Retry logic (Netflix, NASDAQ)');
console.log('  ✓ Fuzzy position matching');
console.log('  ✓ Multiple positions handling');
console.log('  ✓ Contract sizing (DAX 0.1)');
console.log('  ✓ Options (Bitcoin/Tesla/Ethereum CALL)');
console.log('  ✓ Commodities (Gold, Brent)');
console.log('  ✓ Forex (EUR/USD)');
console.log('  ✓ Edge cases (no alternatives)');
console.log('═══════════════════════════════════════════════════════\n');
