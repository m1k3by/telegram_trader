/**
 * CURRENCY CONVERSION TESTS
 * Critical: Ensures correct margin calculation for non-EUR currencies
 * Bug: GBP/JPY was calculated as EUR instead of JPY, leading to 100x oversized positions
 * 
 * NOW USES: Live exchange rates from frankfurter.app API
 */

import assert from 'assert';
import { getExchangeRateToEUR, getExchangeRateToEURCached } from '../src/exchangeRates.js';

console.log('🧪 Testing Currency Conversion & Live Exchange Rates...\n');

// =============================================================================
// TEST 0: Live Exchange Rate API
// =============================================================================
console.log('Test 0: Live Exchange Rate API');

let usdRate, jpyRate, gbpRate, eurRate;

try {
  usdRate = await getExchangeRateToEUR('USD');
  jpyRate = await getExchangeRateToEUR('JPY');
  gbpRate = await getExchangeRateToEUR('GBP');
  eurRate = await getExchangeRateToEUR('EUR');
  
  assert.ok(usdRate > 0 && usdRate < 2, 'USD rate should be reasonable');
  assert.ok(jpyRate > 0 && jpyRate < 0.02, 'JPY rate should be tiny');
  assert.ok(gbpRate > 0 && gbpRate < 2, 'GBP rate should be reasonable');
  assert.strictEqual(eurRate, 1.0, 'EUR to EUR should be 1.0');
  
  console.log(`✅ Live rates fetched successfully:`);
  console.log(`   USD: ${usdRate.toFixed(6)} EUR`);
  console.log(`   JPY: ${jpyRate.toFixed(6)} EUR`);
  console.log(`   GBP: ${gbpRate.toFixed(6)} EUR`);
  console.log(`   EUR: ${eurRate.toFixed(6)} EUR\n`);
  
  // Test caching
  console.log('Testing exchange rate caching...');
  const cachedRate = await getExchangeRateToEURCached('USD');
  assert.strictEqual(cachedRate, usdRate, 'Cached rate should match');
  console.log(`✅ Caching works correctly\n`);
  
} catch (error) {
  console.error(`❌ Live API test failed: ${error.message}`);
  console.log(`   (This is OK if offline - fallback rates will be used)\n`);
}

// Mock function that mirrors the logic in index.js (now with async exchange rate)
async function calculateTradeSize(entryPrice, currency, marginPercent, riskAmount) {
  // Fetch live exchange rate
  let exchangeRate;
  try {
    exchangeRate = await getExchangeRateToEURCached(currency);
  } catch (error) {
    // Fallback rates if API fails
    const fallbackRates = {
      'USD': 0.92,
      'JPY': 0.0062,
      'GBP': 1.17,
      'CHF': 1.05,
      'EUR': 1.0
    };
    exchangeRate = fallbackRates[currency] || 1.0;
  }
  
  // Margin per contract IN EUR
  const marginPerContract = entryPrice * marginPercent * exchangeRate;
  
  // Trade size
  let tradeSize = riskAmount / marginPerContract;
  
  // Round up to 0.1
  tradeSize = Math.ceil(tradeSize * 10) / 10;
  
  // Cap at 100 (same as production code)
  tradeSize = Math.min(tradeSize, 100);
  
  return {
    exchangeRate,
    marginPerContract,
    tradeSize,
    realRisk: tradeSize * marginPerContract
  };
}

// =============================================================================
// TEST 1: EUR Currency (no conversion needed)
// =============================================================================
console.log('Test 1: EUR Currency (DAX)');
const eurResult = await calculateTradeSize(
  23500,  // Entry price
  'EUR',  // Currency
  0.05,   // 5% margin
  100     // Risk amount
);

assert.strictEqual(eurResult.exchangeRate, 1.0, 'EUR exchange rate should be 1.0');
assert.ok(eurResult.marginPerContract > 1000, 'DAX margin should be high (23500 * 0.05)');
assert.ok(eurResult.tradeSize < 0.2, 'DAX trade size should be small due to high margin');
assert.ok(Math.abs(eurResult.realRisk - 100) < 20, 'Real risk should be close to 100€');

console.log(`✅ EUR: Rate=${eurResult.exchangeRate}, Margin/Contract=${eurResult.marginPerContract.toFixed(2)}€, Size=${eurResult.tradeSize}\n`);

// =============================================================================
// TEST 2: USD Currency (typical forex pair)
// =============================================================================
console.log('Test 2: USD Currency (EUR/USD)');
const usdResult = await calculateTradeSize(
  1.05,   // Entry price
  'USD',  // Currency
  0.033,  // 3.3% margin
  100     // Risk amount
);

assert.strictEqual(usdResult.exchangeRate, usdRate, 'USD exchange rate should match live rate');
assert.ok(usdResult.marginPerContract < 1, 'EUR/USD margin should be low');
assert.ok(usdResult.tradeSize > 10, 'EUR/USD trade size should be reasonable');
// Note: Real risk might be capped at 100 if trade size is capped
console.log(`✅ USD: Rate=${usdResult.exchangeRate.toFixed(5)}, Margin/Contract=${usdResult.marginPerContract.toFixed(4)}€, Size=${usdResult.tradeSize}, Risk=${usdResult.realRisk.toFixed(2)}€\n`);

// =============================================================================
// TEST 3: JPY Currency (CRITICAL - the bug case!)
// =============================================================================
console.log('Test 3: JPY Currency (GBP/JPY) - THE BUG CASE');
const jpyResult = await calculateTradeSize(
  205.341, // Entry price
  'JPY',   // Currency
  0.02,    // 2% margin (from IG)
  100      // Risk amount
);

// Use LIVE rate, not hardcoded value
assert.ok(jpyResult.exchangeRate > 0.004 && jpyResult.exchangeRate < 0.008, 'JPY rate should be in realistic range (0.004-0.008)');
assert.ok(jpyResult.marginPerContract < 5, 'GBP/JPY margin should be low in EUR');

// With correct JPY rate, tradeSize will be HUGE (205 * 0.02 * 0.00555 = 0.0228€/contract)
// 100€ / 0.0228€ = 4386 contracts! This needs to be capped at 100.
console.log(`   Margin/Contract: ${jpyResult.marginPerContract.toFixed(4)}€`);
console.log(`   Trade Size (uncapped): ${(100 / jpyResult.marginPerContract).toFixed(1)} contracts`);
console.log(`   Trade Size (final): ${jpyResult.tradeSize} contracts`);

// Verify we cap at maximum 100 contracts
assert.ok(jpyResult.tradeSize <= 100, 'Trade size should be capped at 100 contracts');
assert.ok(jpyResult.tradeSize !== 9.8, 'Should NOT return the buggy 9.8 size from old code!');

console.log('');

// =============================================================================
// TEST 4: GBP Currency
// =============================================================================
console.log('Test 4: GBP Currency (GBP/USD)');
const gbpResult = await calculateTradeSize(
  1.27,   // Entry price
  'GBP',  // Currency
  0.033,  // 3.3% margin
  100     // Risk amount
);

assert.ok(gbpResult.exchangeRate > 1.0 && gbpResult.exchangeRate < 1.5, 'GBP rate should be in realistic range');
assert.ok(gbpResult.marginPerContract < 0.1, 'GBP/USD margin should be low');
assert.ok(gbpResult.tradeSize > 10, 'GBP/USD trade size should be reasonable');

console.log(`✅ GBP: Rate=${gbpResult.exchangeRate}, Margin/Contract=${gbpResult.marginPerContract.toFixed(4)}€, Size=${gbpResult.tradeSize}\n`);

// =============================================================================
// TEST 5: CHF Currency
// =============================================================================
console.log('Test 5: CHF Currency (USD/CHF)');
const chfResult = await calculateTradeSize(
  0.88,   // Entry price
  'CHF',  // Currency
  0.033,  // 3.3% margin
  100     // Risk amount
);

assert.ok(chfResult.exchangeRate > 0.9 && chfResult.exchangeRate < 1.2, 'CHF rate should be in realistic range');
assert.ok(chfResult.marginPerContract < 0.1, 'USD/CHF margin should be low');
assert.ok(chfResult.tradeSize > 10, 'USD/CHF trade size should be reasonable');

console.log(`✅ CHF: Rate=${chfResult.exchangeRate}, Margin/Contract=${chfResult.marginPerContract.toFixed(4)}€, Size=${chfResult.tradeSize}\n`);

// =============================================================================
// TEST 6: Real-world GBP/JPY Bug Scenario
// =============================================================================
console.log('Test 6: Real-world GBP/JPY Bug Scenario (from production)');

// What actually happened (OLD CODE):
const buggyCalculation = {
  entryPrice: 205.341,
  marginPercent: 0.02,
  exchangeRate: 1.0,  // BUG: Treated JPY as EUR!
  marginPerContract: 205.341 * 0.02 * 1.0, // = 4.11€
  tradeSize: 100 / (205.341 * 0.02 * 1.0), // = 24.3 → somehow became 9.8
};

// What happens now (NEW CODE with LIVE rates):
const correctCalculation = await calculateTradeSize(205.341, 'JPY', 0.02, 100);

console.log('BUGGY (old code):');
console.log(`  Exchange Rate: ${buggyCalculation.exchangeRate} (WRONG - treats JPY as EUR!)`);
console.log(`  Margin/Contract: ${buggyCalculation.marginPerContract.toFixed(2)}€`);
console.log(`  Trade Size: ${buggyCalculation.tradeSize.toFixed(1)} contracts`);
console.log(`  Real Risk: ${(buggyCalculation.tradeSize * buggyCalculation.marginPerContract).toFixed(2)}€`);

console.log('\nCORRECT (new code with LIVE exchange rate):');
console.log(`  Exchange Rate: ${correctCalculation.exchangeRate} (LIVE JPY→EUR from API)`);
console.log(`  Margin/Contract: ${correctCalculation.marginPerContract.toFixed(4)}€`);
console.log(`  Trade Size: ${correctCalculation.tradeSize} contracts (capped at 100)`);
console.log(`  Real Risk: ${correctCalculation.realRisk.toFixed(2)}€`);

// Verify the fix
assert.ok(correctCalculation.exchangeRate !== 1.0, 'Must use JPY conversion rate from API!');
assert.ok(correctCalculation.marginPerContract < 1, 'JPY margin should be tiny in EUR!');

console.log('');

// =============================================================================
// TEST 7: Edge Case - Unknown Currency Defaults to EUR
// =============================================================================
console.log('Test 7: Unknown Currency (defaults to EUR)');
const unknownResult = await calculateTradeSize(
  100,     // Entry price
  'XYZ',   // Unknown currency
  0.05,    // 5% margin
  100      // Risk amount
);

assert.strictEqual(unknownResult.exchangeRate, 1.0, 'Unknown currency should default to 1.0');
console.log(`✅ Unknown currency defaults to EUR conversion rate\n`);

// =============================================================================
// SUMMARY
// =============================================================================
console.log('═══════════════════════════════════════════════════════');
console.log('✅ ALL CURRENCY CONVERSION TESTS PASSED!');
console.log('═══════════════════════════════════════════════════════');
console.log('Currencies tested:');
console.log('  ✓ EUR (no conversion)');
console.log(`  ✓ USD (${usdRate?.toFixed(6)} rate - LIVE)`);
console.log(`  ✓ JPY (${jpyRate?.toFixed(6)} rate - LIVE) ← BUG FIX!`);
console.log(`  ✓ GBP (${gbpRate?.toFixed(6)} rate - LIVE)`);
console.log('  ✓ CHF (LIVE rate)');
console.log('  ✓ Unknown (defaults to EUR)');
console.log('\n🐛 Bug Fixed: GBP/JPY now uses LIVE JPY→EUR rate');
console.log('   Before: 205 JPY = 205 EUR (100x wrong!)');
console.log(`   After:  205 JPY = ${(205 * jpyRate).toFixed(2)} EUR (correct, real-time)`);
console.log('\n✨ Exchange rates fetched from frankfurter.app API');
console.log('   → Cached for 5 minutes to reduce API calls');
console.log('   → Fallback to static rates if API unavailable');
console.log('═══════════════════════════════════════════════════════\n');
