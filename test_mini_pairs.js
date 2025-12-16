import { igApi } from './src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function testMiniPairs() {
  await new Promise(r => setTimeout(r, 2000));
  
  const pairs = [
    { name: 'GBP/JPY Mini', epic: 'CS.D.GBPJPY.MINI.IP' },
    { name: 'CAD/JPY Mini', epic: 'CS.D.CADJPY.MINI.IP' },
    { name: 'EUR/USD Mini', epic: 'CS.D.EURUSD.MINI.IP' }
  ];
  
  console.log('\n🧪 Testing MINI FOREX Pairs\n');
  console.log('═'.repeat(70));
  
  for (const pair of pairs) {
    console.log(`\n📊 ${pair.name} (${pair.epic}):`);
    
    const details = await igApi.getMarketDetails(pair.epic);
    
    if (details) {
      console.log(`   ✅ Valid`);
      console.log(`   Bid/Offer: ${details.bid} / ${details.offer}`);
      console.log(`   Currency: ${details.currencyCode}`);
      console.log(`   Contract Size: ${details.rawData?.instrument?.contractSize} units`);
      console.log(`   Margin: ${details.marginFactor}%`);
      console.log(`   Min Deal Size: ${details.minDealSize}`);
      
      // Calculate margin for 0.3 contracts
      const entryPrice = details.offer;
      const marginPercent = details.marginFactor / 100;
      const contractSize = details.rawData?.instrument?.contractSize || 10000;
      const tradeSize = 0.3;
      
      // Get exchange rate
      const currency = details.currencyCode;
      let exchangeRate = 1.0;
      if (currency === 'JPY') exchangeRate = 0.00555;
      if (currency === 'USD') exchangeRate = 0.8587;
      if (currency === 'CAD') exchangeRate = 0.68;
      
      const marginPerContract = entryPrice * marginPercent * exchangeRate * contractSize;
      const totalMargin = marginPerContract * tradeSize;
      
      console.log(`\n   📊 Margin für ${tradeSize} Kontrakte:`);
      console.log(`      Formula: ${entryPrice} × ${(marginPercent * 100).toFixed(2)}% × ${exchangeRate} × ${contractSize}`);
      console.log(`      Per Contract: ${marginPerContract.toFixed(2)}€`);
      console.log(`      Total (${tradeSize} contracts): ${totalMargin.toFixed(2)}€`);
    } else {
      console.log(`   ❌ Not found or invalid`);
    }
  }
  
  console.log('\n═'.repeat(70));
  console.log('\n✅ Alle Pairs sollten jetzt 10,000 Contract Size haben!');
  console.log('   (nicht 100,000 wie vorher)');
  console.log('═'.repeat(70));
  
  process.exit(0);
}

testMiniPairs();
