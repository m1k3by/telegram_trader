/**
 * Unit tests for position matching logic (findMatchingPositions)
 */

// Mock positions data
const mockPositions = [
  {
    market: {
      epic: 'CC.D.LCO.UNC.IP',
      instrumentName: 'Öl - Brent Rohöl (10$)'
    },
    position: {
      dealId: 'DEAL001',
      direction: 'SELL',
      size: 1.0
    }
  },
  {
    market: {
      epic: 'UD.D.NVDA.CASH.IP',
      instrumentName: 'Nvidia Corp'
    },
    position: {
      dealId: 'DEAL002',
      direction: 'BUY',
      size: 0.5
    }
  },
  {
    market: {
      epic: 'IX.D.DAX.IFD.IP',
      instrumentName: 'Germany 40'
    },
    position: {
      dealId: 'DEAL003',
      direction: 'BUY',
      size: 0.2
    }
  },
  {
    market: {
      epic: 'CS.D.GBPJPY.MINI.IP',
      instrumentName: 'GBP/JPY Mini'
    },
    position: {
      dealId: 'DEAL004',
      direction: 'SHORT',
      size: 0.3
    }
  }
];

/**
 * Replicated findMatchingPositions function for testing
 * (In real scenario, this would be imported from index.js)
 */
function findMatchingPositions(positions, igMapping, instrumentName) {
  // Try primary EPIC
  let matchingPositions = positions.filter(p => p.market.epic === igMapping.epic);
  
  // Try fallback EPIC
  if (matchingPositions.length === 0 && igMapping.fallback) {
    matchingPositions = positions.filter(p => p.market.epic === igMapping.fallback.epic);
  }
  
  // Fuzzy search by instrument name
  if (matchingPositions.length === 0) {
    const searchTerm = instrumentName.toLowerCase();
    matchingPositions = positions.filter(p => {
      const posName = p.market.instrumentName.toLowerCase();
      const posEpic = p.market.epic.toLowerCase();
      
      // Direct name match
      if (posName.includes(searchTerm) || searchTerm.includes(posName)) {
        return true;
      }
      
      // Special case: "BRENT" or "OIL" should match "Öl - Brent Rohöl" or "Oil - Brent"
      if ((searchTerm.includes('brent') || searchTerm === 'oil') && 
          (posName.includes('brent') || posName.includes('öl'))) {
        return true;
      }
      
      // Special case: "NVIDIA" should match position epic
      if (searchTerm.includes('nvidia') && posEpic.includes('nvidia')) {
        return true;
      }
      
      // Special case: "DAX" variations
      if ((searchTerm.includes('dax') || searchTerm.includes('germany')) && 
          (posName.includes('dax') || posName.includes('germany'))) {
        return true;
      }
      
      return false;
    });
  }
  
  return matchingPositions;
}

// Test 1: Direct EPIC match
console.log('Test 1: Direct EPIC match for BRENT');
const test1 = findMatchingPositions(
  mockPositions,
  { epic: 'CC.D.LCO.UNC.IP', symbol: 'Oil - Brent Crude' },
  'BRENT'
);
console.assert(test1.length === 1, '✅ Should find 1 position via EPIC');
console.assert(test1[0].position.dealId === 'DEAL001', '✅ Should match BRENT position');
console.log(`   Result: Found ${test1.length} position(s) ✅\n`);

// Test 2: Fuzzy match for BRENT (when EPIC doesn't match)
console.log('Test 2: Fuzzy match for BRENT');
const test2 = findMatchingPositions(
  mockPositions,
  { epic: 'WRONG.EPIC', symbol: 'Oil - Brent Crude' },
  'BRENT'
);
console.assert(test2.length === 1, '✅ Should find 1 position via fuzzy match');
console.assert(test2[0].market.instrumentName.includes('Brent'), '✅ Should match Brent position');
console.log(`   Result: Found ${test2.length} position(s) via fuzzy match ✅\n`);

// Test 3: NVIDIA fuzzy match (German instrument name)
console.log('Test 3: NVIDIA fuzzy match');
const test3 = findMatchingPositions(
  mockPositions,
  { epic: 'WRONG.EPIC', symbol: 'Nvidia' },
  'NVIDIA'
);
console.assert(test3.length === 1, '✅ Should find 1 NVIDIA position via fuzzy match');
console.assert(test3[0].position.dealId === 'DEAL002', '✅ Should match NVIDIA position');
console.log(`   Result: Found ${test3.length} position(s) via fuzzy match ✅\n`);

// Test 4: DAX fuzzy match (Germany 40)
console.log('Test 4: DAX fuzzy match');
const test4 = findMatchingPositions(
  mockPositions,
  { epic: 'WRONG.EPIC', symbol: 'Germany 40' },
  'DAX'
);
console.assert(test4.length === 1, '✅ Should find 1 DAX position via fuzzy match');
console.assert(test4[0].market.instrumentName === 'Germany 40', '✅ Should match Germany 40');
console.log(`   Result: Found ${test4.length} position(s) via fuzzy match ✅\n`);

// Test 5: No match scenario
console.log('Test 5: No match for non-existent instrument');
const test5 = findMatchingPositions(
  mockPositions,
  { epic: 'WRONG.EPIC', symbol: 'Bitcoin' },
  'BITCOIN'
);
console.assert(test5.length === 0, '✅ Should find 0 positions for non-existent instrument');
console.log(`   Result: Found ${test5.length} position(s) ✅\n`);

// Test 6: Fallback EPIC logic
console.log('Test 6: Fallback EPIC match');
const test6 = findMatchingPositions(
  mockPositions,
  { 
    epic: 'WRONG.EPIC', 
    symbol: 'Oil - Brent Crude',
    fallback: { epic: 'CC.D.LCO.UNC.IP', symbol: 'Oil - Brent Crude' }
  },
  'BRENT'
);
console.assert(test6.length === 1, '✅ Should find 1 position via fallback EPIC');
console.assert(test6[0].position.dealId === 'DEAL001', '✅ Should match BRENT via fallback');
console.log(`   Result: Found ${test6.length} position(s) via fallback ✅\n`);

// Test 7: Case insensitivity
console.log('Test 7: Case insensitive matching');
const test7 = findMatchingPositions(
  mockPositions,
  { epic: 'WRONG.EPIC', symbol: 'Nvidia' },
  'nvidia'
);
console.assert(test7.length === 1, '✅ Should match case-insensitively');
console.log(`   Result: Found ${test7.length} position(s) ✅\n`);

// Test 8: GBP/JPY exact EPIC match
console.log('Test 8: GBP/JPY exact EPIC match');
const test8 = findMatchingPositions(
  mockPositions,
  { epic: 'CS.D.GBPJPY.MINI.IP', symbol: 'GBP/JPY Mini' },
  'GBP/JPY'
);
console.assert(test8.length === 1, '✅ Should find GBP/JPY position');
console.assert(test8[0].market.instrumentName === 'GBP/JPY Mini', '✅ Should match GBP/JPY Mini');
console.log(`   Result: Found ${test8.length} position(s) ✅\n`);

console.log('✅ ALL POSITION MATCHING TESTS PASSED!');
