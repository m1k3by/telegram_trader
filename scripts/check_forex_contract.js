import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkForexContract() {
  try {
    console.log('Logging in to IG...');
    await igApi.login();
    
    console.log('\n✅ Login successful');
    
    // Get all positions
    const positions = await igApi.positions();
    console.log(`\n📊 Found ${positions.length} open positions`);
    
    // Find GBP/JPY position
    const gbpjpyPosition = positions.find(pos => 
      pos.market.instrumentName && pos.market.instrumentName.includes('GBP/JPY')
    );
    
    if (!gbpjpyPosition) {
      console.log('❌ No GBP/JPY position found');
      return;
    }
    
    console.log('\n🔍 GBP/JPY Position Data:');
    console.log('============================');
    console.log(`Instrument Name: ${gbpjpyPosition.market.instrumentName}`);
    console.log(`EPIC: ${gbpjpyPosition.market.epic}`);
    console.log(`\nPosition Details:`);
    console.log(`  Entry Level: ${gbpjpyPosition.position.level}`);
    console.log(`  Size: ${gbpjpyPosition.position.size}`);
    console.log(`  Direction: ${gbpjpyPosition.position.direction}`);
    
    console.log(`\nMarket Data:`);
    console.log(`  Bid: ${gbpjpyPosition.market.bid}`);
    console.log(`  Offer: ${gbpjpyPosition.market.offer}`);
    console.log(`  High: ${gbpjpyPosition.market.high}`);
    console.log(`  Low: ${gbpjpyPosition.market.low}`);
    console.log(`  contractSize: ${gbpjpyPosition.market.contractSize || 'MISSING'}`);
    console.log(`  scalingFactor: ${gbpjpyPosition.market.scalingFactor || 'N/A'}`);
    
    console.log('\n📦 Full market object:');
    console.log(JSON.stringify(gbpjpyPosition.market, null, 2));
    
    // Calculate what P&L SHOULD be
    const level = gbpjpyPosition.position.level;
    const size = gbpjpyPosition.position.size;
    const direction = gbpjpyPosition.position.direction;
    const currentPrice = direction === 'BUY' ? gbpjpyPosition.market.bid : gbpjpyPosition.market.offer;
    
    const priceDiff = direction === 'BUY' ? (currentPrice - level) : (level - currentPrice);
    
    console.log('\n💰 P&L Calculation:');
    console.log('============================');
    console.log(`Entry: ${level}`);
    console.log(`Current: ${currentPrice}`);
    console.log(`Price Diff: ${priceDiff}`);
    console.log(`Size: ${size}`);
    console.log(`\nWithout contract size: ${priceDiff} × ${size} = ${(priceDiff * size).toFixed(4)} JPY`);
    console.log(`With contract size (10k): ${priceDiff} × ${size} × 10000 = ${(priceDiff * size * 10000).toFixed(2)} JPY`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkForexContract();
