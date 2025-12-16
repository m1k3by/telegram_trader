
import { igApi } from '../src/igApi.js';

async function debugMarketData() {
  try {
    console.log('Logging in...');
    await igApi.login();
    
    // 1. Get Open Positions
    console.log('\n--- Open Positions ---');
    const positions = await igApi.getOpenPositions();
    console.log(`Found ${positions.length} positions.`);
    
    if (positions.length > 0) {
      const p = positions[0];
      console.log('First Position Summary:');
      console.log(`Epic: ${p.market.epic}`);
      console.log(`Instrument: ${p.market.instrumentName}`);
      console.log(`Bid: ${p.market.bid}, Offer: ${p.market.offer}`);
      console.log(`Position Level: ${p.position.level}`);
      console.log(`Stop Level: ${p.position.stopLevel}`);
      
      // 2. Get Market Details for this Epic
      console.log(`\n--- Market Details for ${p.market.epic} ---`);
      const details = await igApi.getMarketDetails(p.market.epic);
      console.log('Snapshot Bid:', details.snapshot?.bid);
      console.log('Snapshot Offer:', details.snapshot?.offer);
      console.log('Snapshot NetChange:', details.snapshot?.netChange);
      console.log('Instrument Contract Size:', details.instrument?.contractSize);
      console.log('Instrument Margin Factor:', details.instrument?.marginFactor);
      console.log('Dealing Rules:', JSON.stringify(details.dealingRules, null, 2));
      console.log('Currency:', details.instrument?.currencyCode);
      
      // 3. Get Prices (History)
      console.log(`\n--- Latest Price (Candle) for ${p.market.epic} ---`);
      const prices = await igApi.getPrices(p.market.epic, 'MINUTE', 1);
      if (prices && prices.length > 0) {
        const last = prices[prices.length - 1];
        console.log('Last Candle Close (Bid):', last.closePrice.bid);
        console.log('Last Candle Close (Ask):', last.closePrice.ask);
      } else {
        console.log('No prices returned.');
      }
    } else {
      console.log('No positions to debug.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugMarketData();
