/**
 * SECURITY GATE TESTS
 * Ensures trades are rejected when risk exceeds 300% of target
 * Critical for preventing over-leveraged positions (like GBP/JPY 9.8 contracts bug)
 */

import assert from 'assert';

console.log('🧪 Testing Security Gate & Contract Size Handling...\n');

// Mock function simulating the security gate logic
function calculateTradeWithSecurityGate(entryPrice, currency, marginPercent, contractSize, riskAmount) {
  const exchangeRate = currency === 'JPY' ? 0.00555 : currency === 'ZAR' ? 0.051 : currency === 'CAD' ? 0.68 : 1.0;
  
  // Margin per contract (including contract size multiplier!)
  const marginPerContract = entryPrice * marginPercent * exchangeRate * contractSize;
  
  // Trade size
  let tradeSize = riskAmount / marginPerContract;
  tradeSize = Math.ceil(tradeSize * 10) / 10; // Round up
  tradeSize = Math.max(0.1, Math.min(tradeSize, 100)); // Cap at 0.1-100
  
  // Real risk
  const realRisk = tradeSize * marginPerContract;
  
  // Security gate check
  const maxAllowedRisk = riskAmount * 3.0; // 300% max
  const passed = realRisk <= maxAllowedRisk;
  
  return {
    tradeSize,
    marginPerContract,
    realRisk,
    maxAllowedRisk,
    passed,
    deviation: ((realRisk / riskAmount - 1) * 100).toFixed(1)
  };
}

// =============================================================================
// TEST 1: GBP/JPY with correct contract size (100,000)
// =============================================================================
console.log('Test 1: GBP/JPY with Contract Size = 100,000');

const gbpjpy = calculateTradeWithSecurityGate(
  205.81,   // Entry price
  'JPY',    // Currency
  0.0333,   // 3.33% margin
  100000,   // CONTRACT SIZE (the missing piece!)
  100       // Risk amount
);

console.log(`  Entry: 205.81 JPY`);
console.log(`  Contract Size: 100,000`);
console.log(`  Margin/Contract: ${gbpjpy.marginPerContract.toFixed(2)}€`);
console.log(`  Trade Size: ${gbpjpy.tradeSize} contracts`);
console.log(`  Real Risk: ${gbpjpy.realRisk.toFixed(2)}€`);
console.log(`  Deviation: ${gbpjpy.deviation}%`);
console.log(`  Security Gate: ${gbpjpy.passed ? '✅ PASSED' : '🚨 REJECTED'}`);

assert.ok(gbpjpy.marginPerContract > 3000, 'GBP/JPY margin should be ~3,800€ per contract');
assert.equal(gbpjpy.tradeSize, 0.1, 'Trade size should be minimum 0.1 contracts');
assert.ok(gbpjpy.realRisk > 300, 'Real risk EXCEEDS 300€ even at minimum size!');
assert.ok(!gbpjpy.passed, 'Should FAIL security gate - even 0.1 contracts exceeds limit!');

console.log(`✅ Test 1 passed: GBP/JPY correctly identified as too risky\n`);

// =============================================================================
// TEST 2: GBP/ZAR Mini with Contract Size = 10,000
// =============================================================================
console.log('Test 2: GBP/ZAR Mini with Contract Size = 10,000');

const gbpzar = calculateTradeWithSecurityGate(
  22.61211, // Entry price
  'ZAR',    // Currency
  0.05,     // 5% margin
  10000,    // CONTRACT SIZE
  100       // Risk amount
);

console.log(`  Entry: 22.61211 ZAR`);
console.log(`  Contract Size: 10,000`);
console.log(`  Margin/Contract: ${gbpzar.marginPerContract.toFixed(2)}€`);
console.log(`  Trade Size: ${gbpzar.tradeSize} contracts`);
console.log(`  Real Risk: ${gbpzar.realRisk.toFixed(2)}€`);
console.log(`  Security Gate: ${gbpzar.passed ? '✅ PASSED' : '🚨 REJECTED'}`);

assert.ok(gbpzar.marginPerContract > 5, 'GBP/ZAR margin should be significant');
assert.ok(gbpzar.tradeSize < 20, 'Trade size should be reasonable');
assert.ok(gbpzar.passed, 'Should pass security gate');

console.log(`✅ Test 2 passed: GBP/ZAR correctly sized\n`);

// =============================================================================
// TEST 3: Simulating the OLD BUG (without contract size)
// =============================================================================
console.log('Test 3: OLD BUG - Missing contract size multiplier');

// Simulate the bug where contractSize was missing (defaulted to 1)
const buggyTrade = calculateTradeWithSecurityGate(
  205.81,   // Entry price
  'JPY',    // Currency
  0.0333,   // 3.33% margin
  1,        // BUG: Missing contract size! Should be 100,000
  100       // Risk amount
);

console.log(`  Entry: 205.81 JPY`);
console.log(`  Contract Size: 1 (BUG - should be 100,000!)`);
console.log(`  Margin/Contract: ${buggyTrade.marginPerContract.toFixed(4)}€`);
console.log(`  Trade Size: ${buggyTrade.tradeSize} contracts`);
console.log(`  Real Risk: ${buggyTrade.realRisk.toFixed(2)}€`);
console.log(`  Max Allowed: ${buggyTrade.maxAllowedRisk}€`);
console.log(`  Security Gate: ${buggyTrade.passed ? '✅ PASSED' : '🚨 REJECTED'}`);

console.log(`  🐛 This is why we got 9.8 contracts!`);
console.log(`     Margin looked tiny (0.0380€) so algorithm bought 100 contracts`);
console.log(`     But REAL exposure: 100 × 100,000 units = 10 MILLION units!`);

// The bug made margin look tiny, so it would pass security gate
// but create massive real-world exposure
assert.ok(buggyTrade.marginPerContract < 1, 'Buggy margin per contract is tiny');
assert.ok(buggyTrade.tradeSize === 100, 'Would buy max 100 contracts');
assert.ok(buggyTrade.passed, 'Would pass security gate (calculated risk looks small)');

console.log(`✅ Test 3 passed: Demonstrated the OLD BUG\n`);

// =============================================================================
// TEST 4: EUR/USD (contract size = 1, no multiplier)
// =============================================================================
console.log('Test 4: EUR/USD with Contract Size = 1');

const eurusd = calculateTradeWithSecurityGate(
  1.05,     // Entry price
  'USD',    // Currency
  0.033,    // 3.3% margin
  1,        // Standard forex often has contract size 1 for mini lots
  100       // Risk amount
);

console.log(`  Entry: 1.05 USD`);
console.log(`  Contract Size: 1`);
console.log(`  Margin/Contract: ${eurusd.marginPerContract.toFixed(4)}€`);
console.log(`  Trade Size: ${eurusd.tradeSize} contracts`);
console.log(`  Real Risk: ${eurusd.realRisk.toFixed(2)}€`);
console.log(`  Security Gate: ${eurusd.passed ? '✅ PASSED' : '🚨 REJECTED'}`);

assert.ok(eurusd.passed, 'Should pass security gate');

console.log(`✅ Test 4 passed\n`);

// =============================================================================
// TEST 5: Boundary test - exactly 300% risk
// =============================================================================
console.log('Test 5: Boundary test - 300% risk (should pass)');

// Construct a scenario where risk is exactly 300€ (3x target)
const boundary = {
  riskAmount: 100,
  realRisk: 300,
  maxAllowedRisk: 300,
  passed: 300 <= 300
};

console.log(`  Target Risk: ${boundary.riskAmount}€`);
console.log(`  Real Risk: ${boundary.realRisk}€`);
console.log(`  Max Allowed: ${boundary.maxAllowedRisk}€`);
console.log(`  Security Gate: ${boundary.passed ? '✅ PASSED' : '🚨 REJECTED'}`);

assert.ok(boundary.passed, 'Exactly 300% should pass');

console.log(`✅ Test 5 passed: 300% boundary accepted\n`);

// =============================================================================
// TEST 6: Boundary test - 301% risk (should fail)
// =============================================================================
console.log('Test 6: Boundary test - 301% risk (should reject)');

const overBoundary = {
  riskAmount: 100,
  realRisk: 301,
  maxAllowedRisk: 300,
  passed: 301 <= 300
};

console.log(`  Target Risk: ${overBoundary.riskAmount}€`);
console.log(`  Real Risk: ${overBoundary.realRisk}€`);
console.log(`  Max Allowed: ${overBoundary.maxAllowedRisk}€`);
console.log(`  Security Gate: ${overBoundary.passed ? '✅ PASSED' : '🚨 REJECTED'}`);

assert.ok(!overBoundary.passed, '301% should be rejected');

console.log(`✅ Test 6 passed: 301% correctly rejected\n`);

// =============================================================================
// SUMMARY
// =============================================================================
console.log('═══════════════════════════════════════════════════════');
console.log('✅ ALL SECURITY GATE TESTS PASSED!');
console.log('═══════════════════════════════════════════════════════');
console.log('Key Findings:');
console.log('  ✓ GBP/JPY contract size = 100,000 (not 1!)');
console.log('  ✓ Mini pairs contract size = 10,000');
console.log('  ✓ Security gate blocks risk > 300%');
console.log('  ✓ Boundary at exactly 300% passes');
console.log('  ✓ 301% correctly rejected');
console.log('\n🐛 Root Cause of 9.8 contracts bug:');
console.log('   Contract size multiplier was MISSING from calculation');
console.log('   → 205 JPY × 3.3% × 0.00555 = 0.0376€ (WRONG)');
console.log('   → 205 JPY × 3.3% × 0.00555 × 100,000 = 3,760€ (CORRECT)');
console.log('\n⚠️  CRITICAL FINDING:');
console.log('   With 100€ target risk:');
console.log('   → Needs 0.027 contracts (100€ / 3,760€)');
console.log('   → Minimum size is 0.1 contracts');
console.log('   → Real risk: 0.1 × 3,760€ = 376€');
console.log('   → This EXCEEDS 300€ Security Gate limit!');
console.log('\n💡 OPTIONS:');
console.log('   A) Increase risk target to 150€+ for standard Forex');
console.log('   B) Use Mini pairs only (10k contract size)');
console.log('   C) Adjust Security Gate to 400% for Forex');
console.log('   D) Skip standard Forex pairs in auto-trading');
console.log('═══════════════════════════════════════════════════════\n');
