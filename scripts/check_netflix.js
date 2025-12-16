import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('\n🔍 Checking Netflix Market Status...\n');

try {
  await igApi.login();
  console.log('✅ Logged in\n');
  
  const epic = 'UC.D.NFLX.CASH.IP';
  console.log(`Checking: ${epic}\n`);
  
  const details = await igApi.getMarketDetails(epic);
  
  console.log('Market Details:');
  console.log('================');
  console.log(`Status: ${details.marketStatus}`);
  console.log(`Bid: ${details.bid}`);
  console.log(`Offer: ${details.offer}`);
  console.log(`Min Deal Size: ${details.minDealSize}`);
  console.log(`Increment: ${details.dealSizeIncrement}`);
  console.log(`Margin Factor: ${details.marginFactor}%`);
  console.log(`Update Time: ${details.updateTime || 'N/A'}`);
  console.log(`Delay Time: ${details.delayTime || 'N/A'}`);
  console.log('\nFull Snapshot:');
  console.log(JSON.stringify(details.snapshot, null, 2));
  
  // Try alternative EPICs
  console.log('\n\n🔍 Checking Netflix Alternatives...\n');
  
  const alternatives = await igApi.searchMarkets('Netflix');
  console.log(`Found ${alternatives.length} Netflix markets:\n`);
  
  for (const market of alternatives.slice(0, 5)) {
    console.log(`\n📊 ${market.instrumentName} (${market.epic})`);
    console.log(`   Status: ${market.marketStatus}`);
    
    try {
      const altDetails = await igApi.getMarketDetails(market.epic);
      console.log(`   Bid: ${altDetails.bid}`);
      console.log(`   Offer: ${altDetails.offer}`);
      console.log(`   Min Size: ${altDetails.minDealSize}`);
    } catch (e) {
      console.log(`   Error: ${e.message}`);
    }
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
