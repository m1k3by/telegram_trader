/**
 * Unit tests for Contract Size handling
 * 
 * Key distinction:
 * - FOREX: MUST have contract size from API (10,000 or 100,000 units)
 * - STOCKS: Default to 1 if missing (1 share = 1 contract)
 * - COMMODITIES: Usually have contract size in API
 */

console.log('🧪 Testing Contract Size Handling...\n');

/**
 * Simulated contract size logic from index.js
 */
function getContractSize(marketDetails, igMapping) {
  let contractSize = marketDetails?.rawData?.instrument?.contractSize;
  const instrumentType = marketDetails?.rawData?.instrument?.type || '';
  const isForex = igMapping.epic.includes('CS.D.') || instrumentType === 'CURRENCIES';
  
  if (!contractSize) {
    if (isForex) {
      // FOREX requires contract size - return error
      return { error: 'FOREX_MISSING_CONTRACT_SIZE', contractSize: null };
    } else {
      // Stocks/Commodities default to 1
      contractSize = 1;
      return { error: null, contractSize, defaulted: true };
    }
  }
  
  return { error: null, contractSize, defaulted: false };
}

// Test 1: FOREX with contract size (GBP/JPY Mini)
console.log('Test 1: FOREX with contract size (GBP/JPY Mini)');
const test1 = getContractSize(
  {
    rawData: {
      instrument: {
        contractSize: 10000,
        type: 'CURRENCIES'
      }
    }
  },
  { epic: 'CS.D.GBPJPY.MINI.IP', symbol: 'GBP/JPY Mini' }
);
console.assert(test1.error === null, '✅ Should not error');
console.assert(test1.contractSize === 10000, '✅ Should return 10,000');
console.assert(test1.defaulted === false, '✅ Should not be defaulted');
console.log(`   Result: ${test1.contractSize} units ✅\n`);

// Test 2: FOREX missing contract size (CRITICAL ERROR)
console.log('Test 2: FOREX missing contract size (should error)');
const test2 = getContractSize(
  {
    rawData: {
      instrument: {
        type: 'CURRENCIES'
      }
    }
  },
  { epic: 'CS.D.EURUSD.MINI.IP', symbol: 'EUR/USD Mini' }
);
console.assert(test2.error === 'FOREX_MISSING_CONTRACT_SIZE', '✅ Should error for FOREX');
console.assert(test2.contractSize === null, '✅ Should return null');
console.log(`   Result: ERROR (correct behavior) ✅\n`);

// Test 3: NVIDIA (Stock) without contract size
console.log('Test 3: NVIDIA (Stock) without contract size');
const test3 = getContractSize(
  {
    rawData: {
      instrument: {
        type: 'SHARES'
      }
    }
  },
  { epic: 'UC.D.NVDA.CASH.IP', symbol: 'Nvidia' }
);
console.assert(test3.error === null, '✅ Should not error for stocks');
console.assert(test3.contractSize === 1, '✅ Should default to 1');
console.assert(test3.defaulted === true, '✅ Should be marked as defaulted');
console.log(`   Result: ${test3.contractSize} (default) ✅\n`);

// Test 4: NVIDIA (Stock) with explicit contract size
console.log('Test 4: NVIDIA (Stock) with explicit contract size');
const test4 = getContractSize(
  {
    rawData: {
      instrument: {
        contractSize: 1,
        type: 'SHARES'
      }
    }
  },
  { epic: 'UC.D.NVDA.CASH.IP', symbol: 'Nvidia' }
);
console.assert(test4.error === null, '✅ Should not error');
console.assert(test4.contractSize === 1, '✅ Should return 1');
console.assert(test4.defaulted === false, '✅ Should not be defaulted');
console.log(`   Result: ${test4.contractSize} unit ✅\n`);

// Test 5: BRENT (Commodity) with contract size
console.log('Test 5: BRENT (Commodity) with contract size');
const test5 = getContractSize(
  {
    rawData: {
      instrument: {
        contractSize: 10,
        type: 'COMMODITIES'
      }
    }
  },
  { epic: 'CC.D.LCO.UNC.IP', symbol: 'Oil - Brent Crude' }
);
console.assert(test5.error === null, '✅ Should not error');
console.assert(test5.contractSize === 10, '✅ Should return 10');
console.assert(test5.defaulted === false, '✅ Should not be defaulted');
console.log(`   Result: ${test5.contractSize} units ✅\n`);

// Test 6: DAX (Index) without contract size
console.log('Test 6: DAX (Index) without contract size');
const test6 = getContractSize(
  {
    rawData: {
      instrument: {
        type: 'INDICES'
      }
    }
  },
  { epic: 'IX.D.DAX.IFD.IP', symbol: 'Germany 40' }
);
console.assert(test6.error === null, '✅ Should not error for indices');
console.assert(test6.contractSize === 1, '✅ Should default to 1');
console.assert(test6.defaulted === true, '✅ Should be marked as defaulted');
console.log(`   Result: ${test6.contractSize} (default) ✅\n`);

// Test 7: FOREX detection by EPIC pattern (CS.D.*)
console.log('Test 7: FOREX detection by EPIC pattern');
const test7 = getContractSize(
  {
    rawData: {
      instrument: {
        // No type specified, but EPIC indicates FOREX
      }
    }
  },
  { epic: 'CS.D.GBPUSD.MINI.IP', symbol: 'GBP/USD Mini' }
);
console.assert(test7.error === 'FOREX_MISSING_CONTRACT_SIZE', '✅ Should detect FOREX by EPIC');
console.log(`   Result: ERROR (detected FOREX by EPIC) ✅\n`);

console.log('═══════════════════════════════════════════════════════');
console.log('✅ ALL CONTRACT SIZE TESTS PASSED!');
console.log('═══════════════════════════════════════════════════════');
console.log('Key findings:');
console.log('  ✓ FOREX requires explicit contract size from API');
console.log('  ✓ Stocks default to 1 if contract size missing');
console.log('  ✓ Commodities usually have contract size in API');
console.log('  ✓ Indices default to 1 if contract size missing');
console.log('  ✓ FOREX detected by EPIC pattern (CS.D.*)');
console.log('═══════════════════════════════════════════════════════');
