/**
 * Fetch actual margin requirements from IG Markets API
 * This will query the market details for each instrument to get the real margin percentages
 */

import { igLogin, getMarketDetails } from './src/igApi.js';

// List of all instruments we want to check (using actual working EPICs from trendAnalyzer.js)
const INSTRUMENTS = {
  // Indices
  'IX.D.DAX.IFMM.IP': 'DAX',
  'IX.D.SPTRD.IFMM.IP': 'SP500',
  'IX.D.NASDAQ.IFMM.IP': 'NASDAQ',
  'IX.D.DOW.IFMM.IP': 'DOW',
  'IX.D.FTSE.IFMM.IP': 'FTSE',
  
  // Commodities
  'CS.D.CFEGOLD.CEA.IP': 'GOLD',
  'CS.D.USSIGC.CFD.IP': 'SILVER',
  'CC.D.LCO.UNC.IP': 'BRENT',
  'CC.D.CL.UNC.IP': 'WTI',
  
  // Crypto
  'CS.D.BITCOIN.CFD.IP': 'BTC',
  'CS.D.ETHUSD.CFD.IP': 'ETH',
  'CS.D.SOLUSD.CFD.IP': 'SOL',
  'CS.D.XRPUSD.CFD.IP': 'XRP',
  
  // Stocks
  'UD.D.TSLA.CASH.IP': 'TESLA',
  'UA.D.AAPL.CASH.IP': 'APPLE',
  'UD.D.NVDA.CASH.IP': 'NVIDIA',
  'UD.D.MSFT.CASH.IP': 'MICROSOFT',
  'UD.D.META.CASH.IP': 'META',
  'UB.D.AMZN.CASH.IP': 'AMAZON',
  'UC.D.GOOG.CASH.IP': 'GOOGLE',
  'UC.D.NFLX.CASH.IP': 'NETFLIX',
};

async function fetchAllMargins() {
  console.log('🔐 Logging in to IG Markets...\n');
  
  try {
    await igLogin();
    console.log('✅ Login successful\n');
    console.log('📊 Fetching margin requirements...\n');
    console.log('='.repeat(80));
    
    const results = {};
    
    for (const [epic, name] of Object.entries(INSTRUMENTS)) {
      try {
        const details = await getMarketDetails(epic);
        
        if (details && details.marginFactor) {
          const marginPercent = details.marginFactor;  // Already in percent (5 = 5%)
          const marginDecimal = marginPercent / 100;   // Convert to decimal (0.05)
          
          console.log(`${name.padEnd(15)} (${epic})`);
          console.log(`   Margin: ${marginPercent}% (${marginDecimal.toFixed(4)} decimal)`);
          console.log(`   Currency: ${details.currencyCode || 'N/A'}`);
          console.log(`   Min Size: ${details.minDealSize || 'N/A'}`);
          console.log(`   Status: ${details.marketStatus || 'N/A'}`);
          console.log('-'.repeat(80));
          
          results[name] = {
            epic: epic,
            marginPercent: marginPercent,
            marginDecimal: marginDecimal,
            currency: details.currencyCode,
            minSize: details.minDealSize,
            status: details.marketStatus
          };
        } else {
          console.log(`${name.padEnd(15)} (${epic})`);
          console.log(`   ❌ Market not found or no data`);
          console.log('-'.repeat(80));
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`${name.padEnd(15)} (${epic})`);
        console.log(`   ❌ Error: ${error.message}`);
        console.log('-'.repeat(80));
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 SUMMARY - Code for trendAnalyzer.js:');
    console.log('='.repeat(80) + '\n');
    
    // Generate code snippet
    for (const [name, data] of Object.entries(results)) {
      if (data.marginDecimal !== undefined) {
        console.log(`    '${name}': { marginPercent: ${data.marginDecimal.toFixed(4)} }, // ${data.marginPercent}% - Min: ${data.minSize}`);
      }
    }
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
fetchAllMargins();
