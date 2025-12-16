/**
 * Unit Tests für Instrument Mappings zu IG EPICs
 * Testet ob alle Instrumente korrekt gemappt werden
 */

import { mapInstrumentToIG } from '../src/trendAnalyzer.js';
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
 * Test Suite: Commodities Mapping
 */
console.log('\n📊 TESTING COMMODITIES MAPPING\n');
console.log('='.repeat(60));

test('Gold Mapping', () => {
  const mapping = mapInstrumentToIG('GOLD');
  assert.equal(mapping.epic, 'CS.D.CFEGOLD.CEA.IP', 'Gold EPIC should be correct');
  assert.equal(mapping.symbol, 'Gold', 'Gold symbol should be correct');
  assert.equal(mapping.marginPercent, 0.05, 'Gold margin should be 5%');
});

test('Silver Mapping', () => {
  const mapping = mapInstrumentToIG('SILBER');
  assert.equal(mapping.epic, 'CS.D.USSIGC.CFD.IP', 'Silver EPIC should be correct');
  assert.equal(mapping.symbol, 'Silver', 'Silver symbol should be correct');
  assert.equal(mapping.marginPercent, 0.05, 'Silver margin should be 5%');
});

test('Brent Oil Mapping', () => {
  const mapping = mapInstrumentToIG('BRENT');
  assert.equal(mapping.epic, 'CC.D.LCO.UNC.IP', 'Brent EPIC should be correct');
  assert.equal(mapping.symbol, 'Oil - Brent Crude', 'Brent symbol should be correct');
  assert.equal(mapping.marginPercent, 0.10, 'Brent margin should be 10%');
});

test('WTI Oil Mapping', () => {
  const mapping = mapInstrumentToIG('WTI');
  assert.equal(mapping.epic, 'CC.D.CL.UNC.IP', 'WTI EPIC should be correct');
  assert.equal(mapping.symbol, 'Oil - US Crude', 'WTI symbol should be correct');
  assert.equal(mapping.marginPercent, 0.10, 'WTI margin should be 10%');
});

/**
 * Test Suite: Indices Mapping
 */
console.log('\n📊 TESTING INDICES MAPPING\n');
console.log('='.repeat(60));

test('DAX Mapping', () => {
  const mapping = mapInstrumentToIG('DAX');
  assert.equal(mapping.epic, 'IX.D.DAX.IFD.IP', 'DAX EPIC should be correct');
  assert.equal(mapping.symbol, 'Germany 40', 'DAX symbol should be correct');
  assert.equal(mapping.marginPercent, 0.05, 'DAX margin should be 5%');
  // minDealSize fetched from IG API at trade time
  assert(mapping.fallback, 'DAX should have weekend fallback');
  assert.equal(mapping.fallback.epic, 'IX.D.SUNDAX.IGN.IP', 'DAX weekend EPIC should be correct');
});

test('S&P 500 Mapping', () => {
  const mapping = mapInstrumentToIG('S&P500');
  assert.equal(mapping.epic, 'IX.D.SPTRD.IFE.IP', 'S&P500 EPIC should be correct');
  assert.equal(mapping.symbol, 'US 500', 'S&P500 symbol should be correct');
  assert(mapping.fallback, 'S&P500 should have weekend fallback');
});

test('NASDAQ Mapping', () => {
  const mapping = mapInstrumentToIG('NASDAQ');
  assert.equal(mapping.epic, 'IX.D.NASDAQ.IFMM.IP', 'NASDAQ EPIC should be correct');
  assert.equal(mapping.symbol, 'US Tech 100', 'NASDAQ symbol should be correct');
  assert(mapping.fallback, 'NASDAQ should have weekend fallback');
});

test('DOW Jones Mapping', () => {
  const mapping = mapInstrumentToIG('DOW');
  assert.equal(mapping.epic, 'IX.D.DOW.IFMM.IP', 'DOW EPIC should be correct');
  assert.equal(mapping.symbol, 'Wall Street', 'DOW symbol should be correct');
  assert(mapping.fallback, 'DOW should have weekend fallback');
});

/**
 * Test Suite: Forex Mapping
 */
console.log('\n📊 TESTING FOREX MAPPING\n');
console.log('='.repeat(60));

test('EUR/USD Mapping', () => {
  const mapping = mapInstrumentToIG('EUR/USD');
  assert.equal(mapping.epic, 'CS.D.EURUSD.MINI.IP', 'EUR/USD EPIC should be correct');
  assert.equal(mapping.symbol, 'EUR/USD Mini', 'EUR/USD symbol should be correct');
  assert.equal(mapping.marginPercent, 0.033, 'EUR/USD margin should be 3.3%');
  assert.equal(mapping.minDealSize, 0.1, 'EUR/USD min deal size should be 0.1');
});

test('EURUSD (without slash) Mapping', () => {
  const mapping = mapInstrumentToIG('EURUSD');
  assert.equal(mapping.epic, 'CS.D.EURUSD.MINI.IP', 'EURUSD EPIC should be correct');
  assert.equal(mapping.symbol, 'EUR/USD Mini', 'EURUSD symbol should be correct');
});

test('GBP/USD Mapping', () => {
  const mapping = mapInstrumentToIG('GBP/USD');
  assert.equal(mapping.epic, 'CS.D.GBPUSD.MINI.IP', 'GBP/USD EPIC should be correct');
  assert.equal(mapping.symbol, 'GBP/USD Mini', 'GBP/USD symbol should be correct');
  assert.equal(mapping.marginPercent, 0.05, 'GBP/USD margin should be 5%');
});

test('USD/JPY Mapping', () => {
  const mapping = mapInstrumentToIG('USD/JPY');
  assert.equal(mapping.epic, 'CS.D.USDJPY.MINI.IP', 'USD/JPY EPIC should be correct');
  assert.equal(mapping.symbol, 'USD/JPY Mini', 'USD/JPY symbol should be correct');
});

test('AUD/USD Mapping', () => {
  const mapping = mapInstrumentToIG('AUD/USD');
  assert.equal(mapping.epic, 'CS.D.AUDUSD.MINI.IP', 'AUD/USD EPIC should be correct');
  assert.equal(mapping.symbol, 'AUD/USD Mini', 'AUD/USD symbol should be correct');
});

test('EUR/GBP Mapping', () => {
  const mapping = mapInstrumentToIG('EUR/GBP');
  assert.equal(mapping.epic, 'CS.D.EURGBP.MINI.IP', 'EUR/GBP EPIC should be correct');
  assert.equal(mapping.symbol, 'EUR/GBP Mini', 'EUR/GBP symbol should be correct');
});

/**
 * Test Suite: Crypto Mapping
 */
console.log('\n📊 TESTING CRYPTO MAPPING\n');
console.log('='.repeat(60));

test('Bitcoin Mapping (Maps to Bitcoin Cash)', () => {
  const mapping = mapInstrumentToIG('BITCOIN');
  assert.equal(mapping.epic, 'CS.D.BCHUSD.CFD.IP', 'Bitcoin should map to Bitcoin Cash');
  assert.equal(mapping.symbol, 'Bitcoin Cash', 'Symbol should be Bitcoin Cash');
  assert.equal(mapping.marginPercent, 0.50, 'Margin should be 50%');
  assert.equal(mapping.minDealSize, 0.2, 'Min deal size should be 0.2');
});

test('Ethereum Mapping', () => {
  const mapping = mapInstrumentToIG('ETHEREUM');
  assert.equal(mapping.epic, 'CS.D.ETHUSD.CFD.IP', 'Ethereum EPIC should be correct');
  assert.equal(mapping.symbol, 'Ethereum', 'Ethereum symbol should be correct');
  assert.equal(mapping.marginPercent, 0.50, 'Margin should be 50%');
  assert.equal(mapping.minDealSize, 0.2, 'Min deal size should be 0.2');
});

/**
 * Test Suite: US Stocks Mapping
 */
console.log('\n📊 TESTING US STOCKS MAPPING\n');
console.log('='.repeat(60));

test('Tesla Mapping', () => {
  const mapping = mapInstrumentToIG('TESLA');
  assert.equal(mapping.epic, 'UD.D.TSLA.CASH.IP', 'Tesla EPIC should be correct');
  assert.equal(mapping.symbol, 'Tesla', 'Tesla symbol should be correct');
  assert.equal(mapping.marginPercent, 0.20, 'Tesla margin should be 20%');
  // minDealSize is optional and fetched from IG API at trade time
});

test('Apple Mapping', () => {
  const mapping = mapInstrumentToIG('APPLE');
  assert.equal(mapping.epic, 'UA.D.AAPL.CASH.IP', 'Apple EPIC should be correct');
  assert.equal(mapping.symbol, 'Apple', 'Apple symbol should be correct');
  assert.equal(mapping.marginPercent, 0.20, 'Apple margin should be 20%');
});

test('AAPL Ticker Mapping', () => {
  const mapping = mapInstrumentToIG('AAPL');
  assert.equal(mapping.epic, 'UA.D.AAPL.CASH.IP', 'AAPL EPIC should be correct');
  assert.equal(mapping.symbol, 'Apple', 'AAPL symbol should be correct');
});

test('Amazon Mapping', () => {
  const mapping = mapInstrumentToIG('AMAZON');
  assert.equal(mapping.epic, 'UB.D.AMZN.CASH.IP', 'Amazon EPIC should be correct');
  assert.equal(mapping.symbol, 'Amazon', 'Amazon symbol should be correct');
  assert.equal(mapping.marginPercent, 0.20, 'Amazon margin should be 20%');
});

test('Microsoft Mapping', () => {
  const mapping = mapInstrumentToIG('MICROSOFT');
  assert.equal(mapping.epic, 'UD.D.MSFT.CASH.IP', 'Microsoft EPIC should be correct');
  assert.equal(mapping.symbol, 'Microsoft', 'Microsoft symbol should be correct');
});

test('Nvidia Mapping', () => {
  const mapping = mapInstrumentToIG('NVIDIA');
  assert.equal(mapping.epic, 'UD.D.NVDA.CASH.IP', 'Nvidia EPIC should be correct');
  assert.equal(mapping.symbol, 'Nvidia', 'Nvidia symbol should be correct');
});

/**
 * Test Suite: Fallback for Unknown Tickers
 */
console.log('\n📊 TESTING FALLBACK FOR UNKNOWN TICKERS\n');
console.log('='.repeat(60));

test('Unknown US Ticker Starting with A-G', () => {
  const mapping = mapInstrumentToIG('AABC');
  assert.equal(mapping.epic, 'UA.D.AABC.CASH.IP', 'Should generate UA prefix for A-G');
});

test('Unknown US Ticker Starting with H-N', () => {
  const mapping = mapInstrumentToIG('HXYZ');
  assert.equal(mapping.epic, 'UB.D.HXYZ.CASH.IP', 'Should generate UB prefix for H-N');
});

test('Unknown US Ticker Starting with O-T', () => {
  const mapping = mapInstrumentToIG('ORLY');
  assert.equal(mapping.epic, 'UC.D.ORLY.CASH.IP', 'Should generate UC prefix for O-T');
});

test('Unknown US Ticker Starting with U-Z', () => {
  const mapping = mapInstrumentToIG('UBER');
  assert.equal(mapping.epic, 'UD.D.UBER.CASH.IP', 'Should have correct UBER mapping');
});

/**
 * Test Suite: Edge Cases
 */
console.log('\n📊 TESTING EDGE CASES\n');
console.log('='.repeat(60));

test('Lowercase Input', () => {
  const mapping = mapInstrumentToIG('gold');
  assert.equal(mapping.epic, 'CS.D.CFEGOLD.CEA.IP', 'Should handle lowercase');
});

test('Mixed Case Input', () => {
  const mapping = mapInstrumentToIG('TeSlA');
  assert.equal(mapping.epic, 'UD.D.TSLA.CASH.IP', 'Should handle mixed case');
});

test('Unknown Instrument', () => {
  const mapping = mapInstrumentToIG('UNKNOWN_INSTRUMENT_XYZ123');
  assert.equal(mapping.epic, null, 'Unknown instrument should return null EPIC');
  assert.equal(mapping.symbol, 'UNKNOWN_INSTRUMENT_XYZ123', 'Should preserve original symbol');
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
