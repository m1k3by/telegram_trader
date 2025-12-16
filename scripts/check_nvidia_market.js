import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Checking NVIDIA market data when closed...\n');

async function checkNvidia() {
  try {
    const positions = await igApi.getOpenPositions();
    const nvidia = positions.find(p => p.market.epic === 'UC.D.NVDA.CASH.IP');
    
    if (nvidia) {
      console.log('✅ Found NVIDIA position\n');
      console.log('Position Data:');
      console.log('  Entry Level:', nvidia.position.level);
      console.log('  Size:', nvidia.position.size);
      console.log('  Direction:', nvidia.position.direction);
      console.log('');
      console.log('Market Data:');
      console.log('  Bid:', nvidia.market.bid);
      console.log('  Offer:', nvidia.market.offer);
      console.log('  High:', nvidia.market.high);
      console.log('  Low:', nvidia.market.low);
      console.log('');
      console.log('Raw Snapshot:');
      console.log(JSON.stringify(nvidia.market, null, 2));
    } else {
      console.log('❌ No NVIDIA position found');
      
      // Try getting market details directly
      console.log('\n🔍 Getting market details directly...\n');
      const details = await igApi.getMarketDetails('UC.D.NVDA.CASH.IP');
      
      if (details && details.rawData) {
        console.log('Snapshot Data:');
        console.log(JSON.stringify(details.rawData.snapshot, null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

checkNvidia();
