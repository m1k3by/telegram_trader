import { igApi } from './src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Testing NVIDIA EPIC availability...\n');

async function testNvidia() {
  try {
    // Test current EPIC
    console.log('Testing EPIC: UD.D.NVDA.CASH.IP');
    const marketDetails = await igApi.getMarketDetails('UD.D.NVDA.CASH.IP');
    
    if (marketDetails) {
      console.log('✅ EPIC found and working!\n');
      console.log('Market Details:');
      console.log('  Instrument Name:', marketDetails.instrumentName);
      console.log('  Market Status:', marketDetails.marketStatus);
      console.log('  Current Bid:', marketDetails.bid);
      console.log('  Current Offer:', marketDetails.offer);
      console.log('  Min Size:', marketDetails.minSize);
      console.log('  Margin Factor:', marketDetails.marginFactor + '%');
      
      if (marketDetails.rawData?.instrument) {
        console.log('  Contract Size:', marketDetails.rawData.instrument.contractSize);
        console.log('  Lot Size:', marketDetails.rawData.instrument.lotSize);
      }
      
      if (marketDetails.rawData?.snapshot?.marketStatus === 'TRADEABLE') {
        console.log('\n✅ Market is TRADEABLE right now!');
      } else {
        console.log('\n⚠️ Market Status:', marketDetails.rawData?.snapshot?.marketStatus);
      }
    } else {
      console.log('❌ EPIC returned null');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

testNvidia();
