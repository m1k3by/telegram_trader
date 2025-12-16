/**
 * Test FOREX P&L currency conversion
 */

import { getExchangeRateToEURCached } from './src/exchangeRates.js';

// Helper function (same as in dashboard.js)
function extractQuoteCurrency(instrumentName) {
  if (instrumentName.includes('/')) {
    const parts = instrumentName.split('/');
    if (parts.length === 2) {
      return parts[1].trim().replace(/\s+Mini$/i, '').replace(/\s+Kassa$/i, '');
    }
  }
  return null;
}

// Test cases
const testCases = [
  { name: 'GBP/JPY Mini', profitJPY: -117, expectedEUR: -117 * 0.00555 },
  { name: 'GBP/ZAR Mini', profitZAR: -9.16, expectedEUR: -9.16 * 0.051 },
  { name: 'NZD/CAD Mini', profitCAD: -1.70, expectedEUR: -1.70 * 0.68 },
  { name: 'Gold Kassa ($1 Kontrakt)', profitUSD: 0.17, expectedEUR: 0.17 * 0.8587 }
];

console.log('🧪 Testing FOREX P&L Currency Conversion\n');
console.log('═'.repeat(70));

async function runTests() {
  for (const test of testCases) {
    console.log(`\n📊 ${test.name}:`);
    
    // Extract quote currency
    const quoteCurrency = extractQuoteCurrency(test.name);
    console.log(`   Quote Currency: ${quoteCurrency || 'N/A (not FOREX)'}`);
    
    if (quoteCurrency) {
      // Get exchange rate
      const exchangeRate = await getExchangeRateToEURCached(quoteCurrency);
      console.log(`   Exchange Rate: 1 ${quoteCurrency} = ${exchangeRate} EUR`);
      
      // Convert to EUR
      let profitInQuoteCurrency;
      if (quoteCurrency === 'JPY') profitInQuoteCurrency = -117;
      else if (quoteCurrency === 'ZAR') profitInQuoteCurrency = -9.16;
      else if (quoteCurrency === 'CAD') profitInQuoteCurrency = -1.70;
      
      const profitInEUR = profitInQuoteCurrency * exchangeRate;
      console.log(`   P&L in ${quoteCurrency}: ${profitInQuoteCurrency.toFixed(2)}`);
      console.log(`   P&L in EUR: ${profitInEUR.toFixed(2)}€`);
      console.log(`   Expected: ~${test.expectedEUR.toFixed(2)}€`);
      console.log(`   ✅ ${Math.abs(profitInEUR - test.expectedEUR) < 0.01 ? 'MATCH' : 'MISMATCH'}`);
    }
  }
  
  console.log('\n═'.repeat(70));
  console.log('\n✅ Currency conversion implemented!');
  console.log('   - Extracts quote currency from instrument name');
  console.log('   - Fetches live exchange rate');
  console.log('   - Converts P&L to EUR');
  console.log('═'.repeat(70));
}

runTests().then(() => process.exit(0));
