import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

const forexPairs = [
  'CS.D.GBPJPY.CFD.IP',  // GBP/JPY
  'CS.D.GBPZAR.MINI.IP', // GBP/ZAR Mini
  'CS.D.NZDCAD.MINI.IP', // NZD/CAD
];

console.log('\n🔍 Checking FOREX Margin Requirements...\n');

await igApi.login();
console.log('✅ Logged in\n');

for (const epic of forexPairs) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`EPIC: ${epic}`);
  console.log('='.repeat(60));
  
  const details = await igApi.getMarketDetails(epic);
  
  if (details) {
    console.log(`Name: ${details.name}`);
    console.log(`Currency: ${details.currencyCode}`);
    console.log(`Min Deal Size: ${details.minDealSize}`);
    console.log(`Increment: ${details.dealSizeIncrement}`);
    console.log(`Margin Factor: ${details.marginFactor}%`);
    console.log(`Bid: ${details.bid}`);
    console.log(`Offer: ${details.offer}`);
    
    // Calculate margin for 1 contract
    const price = details.offer || details.bid || 0;
    const marginPercent = details.marginFactor / 100;
    
    console.log(`\nMargin Calculation for 1 contract:`);
    console.log(`  Price: ${price}`);
    console.log(`  Margin%: ${(marginPercent * 100).toFixed(1)}%`);
    console.log(`  Base Margin: ${(price * marginPercent).toFixed(4)} ${details.currencyCode}`);
    
    // Check if there's lot size info
    if (details.snapshot) {
      console.log(`\nSnapshot:`);
      console.log(`  Market Status: ${details.snapshot.marketStatus}`);
      console.log(`  Update Time: ${details.snapshot.updateTime}`);
    }
    
    // Check raw instrument data
    if (details.rawData?.instrument) {
      console.log(`\nInstrument Details:`);
      console.log(`  Type: ${details.rawData.instrument.type}`);
      console.log(`  Unit: ${details.rawData.instrument.unit}`);
      console.log(`  Lot Size: ${details.rawData.instrument.lotSize}`);
      console.log(`  Contract Size: ${details.rawData.instrument.contractSize}`);
      console.log(`  Value of 1 Pip: ${details.rawData.instrument.valueOfOnePip}`);
      console.log(`  1 Pip Means: ${details.rawData.instrument.onePipMeans}`);
    }
  } else {
    console.log('❌ Could not fetch details');
  }
}

console.log('\n' + '='.repeat(60) + '\n');
