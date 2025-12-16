/**
 * Test FOREX EPICs to verify they work
 */

import { igApi } from './src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function testForexEpics() {
  console.log('🔐 Logging in...\n');
  
  // Wait for global igApi instance to initialize
  await new Promise(resolve => setTimeout(resolve, 2000));

  const forexPairs = [
    { name: 'GBP/JPY', epic: 'CS.D.GBPJPY.CFD.IP' },
    { name: 'GBP/ZAR Mini', epic: 'CS.D.GBPZAR.MINI.IP' },
    { name: 'NZD/CAD Mini', epic: 'CS.D.NZDCAD.MINI.IP' },
    { name: 'EUR/USD', epic: 'CS.D.EURUSD.CFD.IP' },
    { name: 'USD/JPY', epic: 'CS.D.USDJPY.CFD.IP' }
  ];

  console.log('🧪 Testing FOREX EPICs...\n');
  console.log('='.repeat(60));

  for (const pair of forexPairs) {
    console.log(`\n${pair.name} (${pair.epic}):`);
    
    try {
      const details = await igApi.getMarketDetails(pair.epic);
      
      if (details) {
        console.log(`  ✅ VALID`);
        console.log(`  Market Status: ${details.marketStatus}`);
        console.log(`  Bid/Offer: ${details.bid} / ${details.offer}`);
        console.log(`  Margin: ${details.marginFactor}%`);
        console.log(`  Currency: ${details.currencyCode}`);
        console.log(`  Min Size: ${details.minDealSize}`);
        
        if (details.rawData?.instrument?.contractSize) {
          console.log(`  Contract Size: ${details.rawData.instrument.contractSize} units`);
        }
      } else {
        console.log(`  ❌ INVALID (404 or null)`);
      }
    } catch (err) {
      console.log(`  ❌ ERROR: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

testForexEpics().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
