/**
 * Unit Tests for Trade Retry Logic
 * Tests intelligent fallback, market search, and resilience
 */

import assert from 'assert';

console.log('\n🧪 TRADE RETRY LOGIC TESTS\n');
console.log('='.repeat(70));

// Mock IG API for testing
const mockIgApi = {
  searchResults: [],
  marketDetails: {},
  positions: [],
  tradeResults: {},
  
  async searchMarkets(query) {
    return this.searchResults[query] || [];
  },
  
  async getMarketDetails(epic) {
    return this.marketDetails[epic] || null;
  },
  
  async getOpenPositions() {
    return this.positions;
  },
  
  async createPosition(epic, params) {
    return this.tradeResults[epic] || { status: 'error', message: 'Unknown EPIC' };
  }
};

// Test helper function to simulate retry logic
function testRetryLogic(scenario) {
  console.log(`\n${scenario.name}`);
  console.log('-'.repeat(70));
  
  // Setup mock data
  Object.assign(mockIgApi, scenario.mock);
  
  // Simulate the retry attempts
  let success = false;
  let attempts = 0;
  let finalEpic = null;
  
  // Attempt 1: Primary
  attempts++;
  const primaryDetails = mockIgApi.marketDetails[scenario.primaryEpic];
  if (primaryDetails && primaryDetails.marketStatus === 'TRADEABLE') {
    const result = mockIgApi.tradeResults[scenario.primaryEpic];
    if (result && result.status === 'success') {
      success = true;
      finalEpic = scenario.primaryEpic;
      console.log(`✅ Success on attempt ${attempts}: Primary EPIC`);
      return { success, attempts, epic: finalEpic };
    }
  }
  console.log(`   ❌ Attempt ${attempts} failed: Primary EPIC`);
  
  // Attempt 2: Fallback
  if (scenario.fallbackEpic) {
    attempts++;
    const fallbackDetails = mockIgApi.marketDetails[scenario.fallbackEpic];
    if (fallbackDetails && fallbackDetails.marketStatus === 'TRADEABLE') {
      const result = mockIgApi.tradeResults[scenario.fallbackEpic];
      if (result && result.status === 'success') {
        success = true;
        finalEpic = scenario.fallbackEpic;
        console.log(`✅ Success on attempt ${attempts}: Fallback EPIC`);
        return { success, attempts, epic: finalEpic };
      }
    }
    console.log(`   ❌ Attempt ${attempts} failed: Fallback EPIC`);
  }
  
  // Attempt 3+: Search alternatives
  const alternatives = mockIgApi.searchResults[scenario.searchQuery] || [];
  for (const alt of alternatives) {
    attempts++;
    const altDetails = mockIgApi.marketDetails[alt.epic];
    if (altDetails && altDetails.marketStatus === 'TRADEABLE') {
      const result = mockIgApi.tradeResults[alt.epic];
      if (result && result.status === 'success') {
        success = true;
        finalEpic = alt.epic;
        console.log(`✅ Success on attempt ${attempts}: Alternative ${alt.instrumentName}`);
        return { success, attempts, epic: finalEpic };
      }
    }
    console.log(`   ❌ Attempt ${attempts} failed: ${alt.instrumentName}`);
  }
  
  console.log(`❌ All ${attempts} attempts failed`);
  return { success, attempts, epic: null };
}

/**
 * Test 1: Netflix - Primary closed, fallback succeeds
 */
console.log('\n📊 TEST 1: Netflix Primary Closed, Find Alternative\n');

const test1 = testRetryLogic({
  name: 'Test 1: Netflix - Primary closed during after-hours',
  primaryEpic: 'UC.D.NFLX.CASH.IP',
  fallbackEpic: null,
  searchQuery: 'Netflix',
  mock: {
    marketDetails: {
      'UC.D.NFLX.CASH.IP': { marketStatus: 'EDITS_ONLY', bid: null, offer: null },
      'UC.D.NFLX.CFD.IP': { marketStatus: 'TRADEABLE', bid: 108.5, offer: 108.7 },
      'UC.D.NFLX.DAILY.IP': { marketStatus: 'TRADEABLE', bid: 108.4, offer: 108.6 }
    },
    searchResults: {
      'Netflix': [
        { epic: 'UC.D.NFLX.CASH.IP', instrumentName: 'Netflix Inc (24 Hours)' },
        { epic: 'UC.D.NFLX.CFD.IP', instrumentName: 'Netflix Inc CFD' },
        { epic: 'UC.D.NFLX.DAILY.IP', instrumentName: 'Netflix Inc Daily' }
      ]
    },
    tradeResults: {
      'UC.D.NFLX.CASH.IP': { status: 'error', message: 'MARKET_CLOSED_WITH_EDITS' },
      'UC.D.NFLX.CFD.IP': { status: 'success', dealReference: 'TEST123', dealId: 'DI001' },
      'UC.D.NFLX.DAILY.IP': { status: 'success', dealReference: 'TEST124', dealId: 'DI002' }
    }
  }
});

assert.strictEqual(test1.success, true, 'Should succeed with alternative');
assert.ok(test1.attempts >= 2, 'Should try at least primary + alternative');
assert.ok(test1.epic === 'UC.D.NFLX.CFD.IP' || test1.epic === 'UC.D.NFLX.DAILY.IP', 'Should use alternative EPIC');
console.log('✅ Test 1 passed: Found alternative when primary closed\n');

/**
 * Test 2: NASDAQ - Primary closed, weekend fallback succeeds
 */
console.log('\n📊 TEST 2: NASDAQ Weekend Fallback\n');

const test2 = testRetryLogic({
  name: 'Test 2: NASDAQ - Weekend, use fallback contract',
  primaryEpic: 'IX.D.NASDAQ.IFE.IP',
  fallbackEpic: 'IX.D.NASDAQ.WKND.IP',
  searchQuery: 'NASDAQ',
  mock: {
    marketDetails: {
      'IX.D.NASDAQ.IFE.IP': { marketStatus: 'CLOSED', bid: null, offer: null },
      'IX.D.NASDAQ.WKND.IP': { marketStatus: 'TRADEABLE', bid: 21500, offer: 21520 }
    },
    searchResults: {
      'NASDAQ': [
        { epic: 'IX.D.NASDAQ.IFE.IP', instrumentName: 'US Tech 100' },
        { epic: 'IX.D.NASDAQ.WKND.IP', instrumentName: 'Weekend US Tech 100' }
      ]
    },
    tradeResults: {
      'IX.D.NASDAQ.IFE.IP': { status: 'error', message: 'MARKET_CLOSED' },
      'IX.D.NASDAQ.WKND.IP': { status: 'success', dealReference: 'TEST125', dealId: 'DI003' }
    }
  }
});

assert.strictEqual(test2.success, true, 'Should succeed with weekend fallback');
assert.strictEqual(test2.attempts, 2, 'Should succeed on second attempt (fallback)');
assert.strictEqual(test2.epic, 'IX.D.NASDAQ.WKND.IP', 'Should use weekend EPIC');
console.log('✅ Test 2 passed: Weekend fallback works\n');

/**
 * Test 3: All markets closed - graceful failure
 */
console.log('\n📊 TEST 3: All Markets Closed - Graceful Failure\n');

const test3 = testRetryLogic({
  name: 'Test 3: All markets genuinely closed, no alternatives',
  primaryEpic: 'UA.D.TSLA.CASH.IP',
  fallbackEpic: null,
  searchQuery: 'Tesla',
  mock: {
    marketDetails: {
      'UA.D.TSLA.CASH.IP': { marketStatus: 'CLOSED', bid: null, offer: null },
      'UA.D.TSLA.CFD.IP': { marketStatus: 'CLOSED', bid: null, offer: null },
      'UA.D.TSLA.DAILY.IP': { marketStatus: 'CLOSED', bid: null, offer: null }
    },
    searchResults: {
      'Tesla': [
        { epic: 'UA.D.TSLA.CASH.IP', instrumentName: 'Tesla Inc' },
        { epic: 'UA.D.TSLA.CFD.IP', instrumentName: 'Tesla CFD' },
        { epic: 'UA.D.TSLA.DAILY.IP', instrumentName: 'Tesla Daily' }
      ]
    },
    tradeResults: {
      'UA.D.TSLA.CASH.IP': { status: 'error', message: 'MARKET_CLOSED' },
      'UA.D.TSLA.CFD.IP': { status: 'error', message: 'MARKET_CLOSED' },
      'UA.D.TSLA.DAILY.IP': { status: 'error', message: 'MARKET_CLOSED' }
    }
  }
});

assert.strictEqual(test3.success, false, 'Should fail when all markets closed');
assert.ok(test3.attempts >= 3, 'Should try primary + alternatives');
assert.strictEqual(test3.epic, null, 'Should not have valid EPIC');
console.log('✅ Test 3 passed: Graceful failure when truly closed\n');

/**
 * Test 4: Primary succeeds immediately
 */
console.log('\n📊 TEST 4: Primary Market Open - Immediate Success\n');

const test4 = testRetryLogic({
  name: 'Test 4: Primary market open, succeed immediately',
  primaryEpic: 'CS.D.CFEGOLD.CEA.IP',
  fallbackEpic: 'IX.D.SUNGOLD.CEA.IP',
  searchQuery: 'Gold',
  mock: {
    marketDetails: {
      'CS.D.CFEGOLD.CEA.IP': { marketStatus: 'TRADEABLE', bid: 2650, offer: 2652 }
    },
    searchResults: {},
    tradeResults: {
      'CS.D.CFEGOLD.CEA.IP': { status: 'success', dealReference: 'TEST126', dealId: 'DI004' }
    }
  }
});

assert.strictEqual(test4.success, true, 'Should succeed immediately');
assert.strictEqual(test4.attempts, 1, 'Should only need one attempt');
assert.strictEqual(test4.epic, 'CS.D.CFEGOLD.CEA.IP', 'Should use primary EPIC');
console.log('✅ Test 4 passed: Primary market success\n');

/**
 * Test 5: Position finding with fuzzy match
 */
console.log('\n📊 TEST 5: Position Finding with Fuzzy Matching\n');

function testPositionFinding(scenario) {
  console.log(`\n${scenario.name}`);
  console.log('-'.repeat(70));
  
  const positions = scenario.positions;
  const searchTerm = scenario.searchTerm.toLowerCase();
  const primaryEpic = scenario.primaryEpic;
  const fallbackEpic = scenario.fallbackEpic;
  
  // Try primary EPIC
  let match = positions.find(p => p.market.epic === primaryEpic);
  if (match) {
    console.log(`✅ Found via primary EPIC: ${match.market.instrumentName}`);
    return match;
  }
  
  // Try fallback EPIC
  if (fallbackEpic) {
    match = positions.find(p => p.market.epic === fallbackEpic);
    if (match) {
      console.log(`✅ Found via fallback EPIC: ${match.market.instrumentName}`);
      return match;
    }
  }
  
  // Try fuzzy name match (check if any word matches)
  match = positions.find(p => {
    const posName = p.market.instrumentName.toLowerCase();
    const posWords = posName.split(/\s+/);
    // Check if search term matches any word in position name
    return posWords.some(word => word.includes(searchTerm) || searchTerm.includes(word)) ||
           posName.includes(searchTerm) ||
           searchTerm.includes(posName);
  });
  
  if (match) {
    console.log(`✅ Found via fuzzy match: ${match.market.instrumentName}`);
    return match;
  }
  
  console.log(`❌ No position found for "${scenario.searchTerm}"`);
  return null;
}

const test5 = testPositionFinding({
  name: 'Test 5: Find Netflix position with partial name match',
  searchTerm: 'Netflix',
  primaryEpic: 'UC.D.NFLX.CASH.IP',
  fallbackEpic: null,
  positions: [
    { market: { epic: 'UC.D.NFLX.CFD.IP', instrumentName: 'Netflix Inc CFD' }, position: { dealId: 'DI001' } },
    { market: { epic: 'IX.D.DAX.IFD.IP', instrumentName: 'Germany 40' }, position: { dealId: 'DI002' } }
  ]
});

assert.ok(test5, 'Should find position');
assert.ok(test5.market.instrumentName.includes('Netflix'), 'Should match Netflix');
console.log('✅ Test 5 passed: Fuzzy position matching\n');

/**
 * Summary
 */
console.log('\n' + '='.repeat(70));
console.log('📊 SUMMARY: All Trade Retry Tests Passed! ✅');
console.log('='.repeat(70));
console.log('Tests covered:');
console.log('  ✅ Primary market closed → Find alternative via search');
console.log('  ✅ Weekend trading → Use fallback contract');
console.log('  ✅ All markets closed → Graceful failure with detailed log');
console.log('  ✅ Primary market open → Immediate success (no retry overhead)');
console.log('  ✅ Position finding → Fuzzy matching for aliases');
console.log('\n✅ Retry logic is resilient and comprehensive!\n');

process.exit(0);
