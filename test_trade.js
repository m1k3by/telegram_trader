
import { igApi } from './src/igApi.js';

async function testBrentTrade() {
  console.log('🧪 Testing Brent Oil Trade...');
  
  // Mock Signal for Brent
  const signal = {
    symbol: 'Oil - Brent Crude',
    epic: 'CC.D.LCO.UNC.IP',
    direction: 'SELL',
    expiry: '-',
    entryPrice: 72.50,
    stopLoss: 72.00,
    takeProfit: 73.00
  };

  try {
    const result = await igApi.executeTrade(signal);
    console.log('\n🏁 Test Result:');
    console.log(JSON.stringify(result, null, 2));

    // Check open positions
    console.log('\n🔍 Checking Open Positions...');
    const positions = await igApi.getOpenPositions();
    const brentPosition = positions.find(p => p.market.epic === signal.epic);
    
    if (brentPosition) {
      console.log('✅ BRENT POSITION FOUND!');
      console.log(JSON.stringify(brentPosition, null, 2));
    } else {
      console.log('❌ No Brent position found.');
    }

  } catch (error) {
    console.error('❌ Test Failed:', error);
  }
}

testBrentTrade();
