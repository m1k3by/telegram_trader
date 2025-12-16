/**
 * Unit Tests für Telegram Message Parser
 * Testet alle eingehenden Signal-Nachrichten aus echten Trades
 */

import { parseLiveTrend } from '../src/trendAnalyzer.js';
import { strict as assert } from 'assert';

// Test Counter
let passedTests = 0;
let failedTests = 0;
const failedTestDetails = [];

/**
 * Test Helper Function
 */
function test(description, testFn) {
  try {
    testFn();
    passedTests++;
    console.log(`✅ ${description}`);
  } catch (error) {
    failedTests++;
    failedTestDetails.push({ description, error: error.message });
    console.log(`❌ ${description}`);
    console.log(`   Error: ${error.message}\n`);
  }
}

/**
 * Test Suite: Position Open Signals
 */
console.log('\n📊 TESTING POSITION OPEN SIGNALS\n');
console.log('='.repeat(60));

// Test 1: Gold Position
test('Gold VERKAUFE Signal', () => {
  const message = 'ICH VERKAUFE GOLD (EK: 4220.98)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should be POSITION_OPEN');
  assert.equal(result.data.instrument, 'GOLD', 'Instrument should be GOLD');
  assert.equal(result.data.direction, 'SELL', 'Direction should be SELL');
  assert.equal(result.data.entryPrice, 4220.98, 'Entry price should be 4220.98');
});

// Test 2: Tesla CALL Option
test('Tesla CALL Option Signal', () => {
  const message = 'ICH KAUFE TESLA CALL 440 (EK: 16.25)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should be POSITION_OPEN');
  assert.equal(result.data.instrument, 'TESLA', 'Instrument should be TESLA');
  assert.equal(result.data.direction, 'BUY', 'Direction should be BUY (CALL)');
  assert.equal(result.data.entryPrice, 16.25, 'Entry price should be 16.25');
  assert.equal(result.data.isOption, true, 'Should be marked as option');
  assert.equal(result.data.optionType, 'CALL', 'Option type should be CALL');
  assert.equal(result.data.strikePrice, 440, 'Strike price should be 440');
});

// Test 3: EUR/USD Forex
test('EUR/USD KAUFE Signal', () => {
  const message = 'ICH KAUFE EUR/USD (EK: 1.15954)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should be POSITION_OPEN');
  assert.equal(result.data.instrument, 'EUR/USD', 'Instrument should be EUR/USD');
  assert.equal(result.data.direction, 'BUY', 'Direction should be BUY');
  assert.equal(result.data.entryPrice, 1.15954, 'Entry price should be 1.15954');
});

// Test 4: GBP/USD Forex
test('GBP/USD VERKAUFE Signal', () => {
  const message = 'ICH VERKAUFE GBP/USD (EK: 1.2650)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should be POSITION_OPEN');
  assert.equal(result.data.instrument, 'GBP/USD', 'Instrument should be GBP/USD');
  assert.equal(result.data.direction, 'SELL', 'Direction should be SELL');
  assert.equal(result.data.entryPrice, 1.2650, 'Entry price should be 1.2650');
});

// Test 5: Bitcoin CALL Option (trades as Bitcoin Cash)
test('Bitcoin CALL Option Signal', () => {
  const message = 'ICH KAUFE BITCOIN CALL 92000 (EK: 4435.00)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should be POSITION_OPEN');
  assert.equal(result.data.instrument, 'BITCOIN', 'Instrument should be BITCOIN');
  assert.equal(result.data.direction, 'BUY', 'Direction should be BUY (CALL)');
  assert.equal(result.data.entryPrice, 4435, 'Entry price should be 4435');
  assert.equal(result.data.isOption, true, 'Should be marked as option');
  assert.equal(result.data.strikePrice, 92000, 'Strike price should be 92000');
});

// Test 6: DAX Index
test('DAX KAUFE Signal', () => {
  const message = 'ICH KAUFE DAX (EK: 19500.5)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should be POSITION_OPEN');
  assert.equal(result.data.instrument, 'DAX', 'Instrument should be DAX');
  assert.equal(result.data.direction, 'BUY', 'Direction should be BUY');
  assert.equal(result.data.entryPrice, 19500.5, 'Entry price should be 19500.5');
});

// Test 7: S&P 500
test('S&P500 VERKAUFE Signal', () => {
  const message = 'ICH VERKAUFE S&P500 (EK: 5950.25)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should be POSITION_OPEN');
  assert.equal(result.data.instrument, 'S&P500', 'Instrument should be S&P500');
  assert.equal(result.data.direction, 'SELL', 'Direction should be SELL');
  assert.equal(result.data.entryPrice, 5950.25, 'Entry price should be 5950.25');
});

// Test 8: Silver
test('SILBER KAUFE Signal', () => {
  const message = 'ICH KAUFE SILBER (EK: 32.45)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should be POSITION_OPEN');
  assert.equal(result.data.instrument, 'SILBER', 'Instrument should be SILBER');
  assert.equal(result.data.direction, 'BUY', 'Direction should be BUY');
  assert.equal(result.data.entryPrice, 32.45, 'Entry price should be 32.45');
});

// Test 9: Oil (Brent)
test('BRENT VERKAUFE Signal', () => {
  const message = 'ICH VERKAUFE BRENT (EK: 73.50)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should be POSITION_OPEN');
  assert.equal(result.data.instrument, 'BRENT', 'Instrument should be BRENT');
  assert.equal(result.data.direction, 'SELL', 'Direction should be SELL');
  assert.equal(result.data.entryPrice, 73.50, 'Entry price should be 73.50');
});

// Test 10: Ethereum PUT Option
test('Ethereum PUT Option Signal', () => {
  const message = 'ICH KAUFE ETHEREUM PUT 3300 (EK: 245.00)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should be POSITION_OPEN');
  assert.equal(result.data.instrument, 'ETHEREUM', 'Instrument should be ETHEREUM');
  assert.equal(result.data.direction, 'SELL', 'Direction should be SELL (PUT)');
  assert.equal(result.data.entryPrice, 245, 'Entry price should be 245');
  assert.equal(result.data.isOption, true, 'Should be marked as option');
  assert.equal(result.data.optionType, 'PUT', 'Option type should be PUT');
  assert.equal(result.data.strikePrice, 3300, 'Strike price should be 3300');
});

// Test 10b: Bitcoin CALL with LIVE TREND emoji prefix (User's exact message)
test('Bitcoin CALL with 🚦LIVE TREND🚦 prefix', () => {
  const message = '🚦LIVE TREND🚦\nICH KAUFE BITCOIN CALL 92000 (EK: 4435.00)\nHier traden: https://cutt.ly/tradecfd\nIch wähle den maximalen Multiplikator ℹ️';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should be POSITION_OPEN');
  assert.equal(result.data.instrument, 'BITCOIN', 'Instrument should be BITCOIN');
  assert.equal(result.data.direction, 'BUY', 'Direction should be BUY (CALL)');
  assert.equal(result.data.entryPrice, 4435, 'Entry price should be 4435');
  assert.equal(result.data.isOption, true, 'Should be marked as option');
  assert.equal(result.data.optionType, 'CALL', 'Option type should be CALL');
  assert.equal(result.data.strikePrice, 92000, 'Strike price should be 92000');
  assert.equal(result.data.symbol, 'Bitcoin Cash', 'Should map to Bitcoin Cash');
});

/**
 * Test Suite: Position Close Signals
 */
console.log('\n📊 TESTING POSITION CLOSE SIGNALS\n');
console.log('='.repeat(60));

// Test 11: Close with Profit
test('Position Close with Profit', () => {
  const message = 'ICH SCHLIEßE GOLD❗442€ GEWINN 🎉🤑📈📉\nGlückwunsch an alle die dabei waren 👍\nHier kannst du mittraden: cutt.ly/tradecfd';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_CLOSE', 'Should be POSITION_CLOSE');
  assert.equal(result.data.instrument, 'GOLD', 'Instrument should be GOLD');
  assert.equal(result.data.result, 'GEWINN', 'Result should be GEWINN');
  assert.equal(result.data.profit, 442, 'Profit should be 442');
});

// Test 12: Close with Loss
test('Position Close with Loss', () => {
  const message = 'ICH SCHLIEßE DAX❗125€ VERLUST\nLeider diesmal kein Gewinn\nHier kannst du mittraden: cutt.ly/tradecfd';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_CLOSE', 'Should be POSITION_CLOSE');
  assert.equal(result.data.instrument, 'DAX', 'Instrument should be DAX');
  assert.equal(result.data.result, 'VERLUST', 'Result should be VERLUST');
  assert.equal(result.data.profit, -125, 'Loss should be -125');
});

// Test 13: Close EUR/USD with Profit
test('EUR/USD Close with Profit', () => {
  const message = 'ICH SCHLIEßE EUR/USD❗215€ GEWINN 🎉\nSuper Trade!\nHier kannst du mittraden: cutt.ly/tradecfd';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_CLOSE', 'Should be POSITION_CLOSE');
  assert.equal(result.data.instrument, 'EUR/USD', 'Instrument should be EUR/USD');
  assert.equal(result.data.result, 'GEWINN', 'Result should be GEWINN');
  assert.equal(result.data.profit, 215, 'Profit should be 215');
});

/**
 * Test Suite: Stop Loss Updates
 */
console.log('\n📊 TESTING STOP LOSS UPDATES\n');
console.log('='.repeat(60));

// Test 14: SL Update
test('Stop Loss Update Signal', () => {
  const message = 'GOLD SL AUF 4200\nStop Loss angepasst!';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'SL_UPDATE', 'Should be SL_UPDATE');
  assert.equal(result.data.instrument, 'GOLD', 'Instrument should be GOLD');
  assert.equal(result.data.stopLoss, 4200, 'SL Level should be 4200');
});

// Test 15: SL Update with "Setze"
test('Stop Loss Update with "Setze"', () => {
  const message = 'Ich setze den SL bei DAX auf 19400';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'SL_UPDATE', 'Should be SL_UPDATE');
  assert.equal(result.data.instrument, 'DAX', 'Instrument should be DAX');
  assert.equal(result.data.stopLoss, 19400, 'SL Level should be 19400');
});

// Test 16: SL to Break Even
test('Stop Loss to Break Even', () => {
  const message = 'EUR/USD SL AUF 1.1595\nPosition abgesichert!';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'SL_UPDATE', 'Should be SL_UPDATE');
  assert.equal(result.data.instrument, 'EUR/USD', 'Instrument should be EUR/USD');
  assert.equal(result.data.stopLoss, 1.1595, 'SL Level should be 1.1595');
});

/**
 * Test Suite: Take Profit Updates
 */
console.log('\n📊 TESTING TAKE PROFIT UPDATES\n');
console.log('='.repeat(60));

// Test 17: TP Update
test('Take Profit Update Signal', () => {
  const message = 'GOLD TP AUF 4250\nZiel angepasst!';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'TP_UPDATE', 'Should be TP_UPDATE');
  assert.equal(result.data.instrument, 'GOLD', 'Instrument should be GOLD');
  assert.equal(result.data.takeProfit, 4250, 'TP Level should be 4250');
});

// Test 18: TP Update with "Setze"
test('Take Profit Update with "Setze"', () => {
  const message = 'Ich setze den TP bei DAX auf 19600';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'TP_UPDATE', 'Should be TP_UPDATE');
  assert.equal(result.data.instrument, 'DAX', 'Instrument should be DAX');
  assert.equal(result.data.takeProfit, 19600, 'TP Level should be 19600');
});

/**
 * Test Suite: Edge Cases
 */
console.log('\n📊 TESTING EDGE CASES\n');
console.log('='.repeat(60));

// Test 19: Price with comma
test('Price with comma format', () => {
  const message = 'ICH KAUFE GOLD (EK: 4220,50)\nHier traden: https://cutt.ly/tradecfd';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should be POSITION_OPEN');
  assert.equal(result.data.entryPrice, 4220.50, 'Should parse comma as decimal separator');
});

// Test 20: Multiple spaces
test('Message with multiple spaces', () => {
  const message = 'ICH   KAUFE   GOLD   (EK:   4220.50)';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should handle multiple spaces');
  assert.equal(result.data.instrument, 'GOLD', 'Should extract instrument correctly');
});

// Test 21: Lowercase instrument
test('Lowercase instrument name', () => {
  const message = 'ICH KAUFE gold (EK: 4220.50)';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should handle lowercase');
  assert.equal(result.data.instrument, 'GOLD', 'Should uppercase instrument');
});

// Test 22: No links/emojis
test('Minimal message format', () => {
  const message = 'ICH VERKAUFE DAX (EK: 19500)';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should work without extra content');
  assert.equal(result.data.direction, 'SELL', 'Direction should be SELL');
});

// Test 23: Extra newlines
test('Message with extra newlines', () => {
  const message = 'ICH KAUFE GOLD (EK: 4220.50)\n\n\nHier traden: link';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should handle extra newlines');
});

/**
 * Test Suite: Invalid/Unknown Messages
 */
console.log('\n📊 TESTING INVALID MESSAGES\n');
console.log('='.repeat(60));

// Test 24: Random promotional message
test('Promotional message (should be UNKNOWN)', () => {
  const message = 'Was euch in der Trend Community erwartet?\n📝 Bis zu 25 Trading Tipps täglich\n📚 Ebooks & Schulungsmaterial';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'UNKNOWN', 'Should be marked as UNKNOWN');
});

// Test 25: Empty message
test('Empty message', () => {
  const message = '';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'UNKNOWN', 'Empty message should be UNKNOWN');
});

// Test 26: Only emojis
test('Only emojis', () => {
  const message = '🎉🎉🎉';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'UNKNOWN', 'Only emojis should be UNKNOWN');
});

/**
 * Print Test Summary
 */
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Total: ${passedTests + failedTests}`);
console.log(`🎯 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);

if (failedTests > 0) {
  console.log('\n❌ FAILED TEST DETAILS:');
  console.log('='.repeat(60));
  failedTestDetails.forEach((test, index) => {
    console.log(`\n${index + 1}. ${test.description}`);
    console.log(`   ${test.error}`);
  });
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED!\n');
  process.exit(0);
}
