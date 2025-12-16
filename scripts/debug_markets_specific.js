
import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function runDebug() {
  try {
    console.log('🔑 Logging in...');
    await igApi.login();
    console.log('✅ Logged in');

    // 1. Check DAX
    console.log('\n--- CHECKING DAX (IX.D.DAX.IFMM.IP) ---');
    const daxDetails = await igApi.getMarketDetails('IX.D.DAX.IFMM.IP');
    if (daxDetails) {
      console.log('Market Status:', daxDetails.marketStatus);
      console.log('Min Deal Size:', daxDetails.minDealSize);
      console.log('Deal Size Increment:', daxDetails.dealSizeIncrement);
      console.log('Bid:', daxDetails.bid);
      console.log('Offer:', daxDetails.offer);
      console.log('Margin Factor:', daxDetails.marginFactor);
      console.log('Margin Band:', JSON.stringify(daxDetails.marginDepositBands?.[0]));
      
      // Calculate Risk for 1 contract
      const price = daxDetails.offer;
      const marginPercent = (daxDetails.marginFactor || daxDetails.marginDepositBands?.[0]?.margin) / 100;
      const margin = price * marginPercent;
      console.log(`Estimated Margin per 1 contract: ${margin.toFixed(2)} EUR`);
    } else {
      console.log('❌ Could not get DAX details');
    }

    // 2. Check GBP/JPY
    console.log('\n--- CHECKING GBP/JPY (CS.D.GBPJPY.MINI.IP) ---');
    const gbpjpyDetails = await igApi.getMarketDetails('CS.D.GBPJPY.MINI.IP');
    if (gbpjpyDetails) {
      console.log('Market Status:', gbpjpyDetails.marketStatus);
      console.log('Min Deal Size:', gbpjpyDetails.minDealSize);
      console.log('Deal Size Increment:', gbpjpyDetails.dealSizeIncrement);
      console.log('Bid:', gbpjpyDetails.bid);
      console.log('Offer:', gbpjpyDetails.offer);
      
      // Try to place a small SELL order (0.1) to see if it works or fails
      // Only if market is open
      if (gbpjpyDetails.marketStatus === 'TRADEABLE') {
          console.log('⚠️ Attempting TEST SELL trade on GBP/JPY (0.1)...');
          try {
              const result = await igApi.executeTrade({
                epic: 'CS.D.GBPJPY.MINI.IP',
                symbol: 'GBP/JPY Mini',
                direction: 'SELL',
                size: 0.1,
                currency: 'GBP',
                expiry: '-'
              });
              console.log('Trade Result:', result);
              
              if (result.status === 'success') {
                  console.log('✅ Trade SUCCESS! Closing immediately...');
                  await igApi.closePosition(result.dealId, 'CS.D.GBPJPY.MINI.IP', 'SELL', 0.1, 'GBP'); 
                  // Note: dealReference might not be dealId, but closePosition expects dealId. 
                  // executeTrade returns { status: 'success', dealReference: ..., dealId: ... }
                  // Let's check what executeTrade returns exactly in src/igApi.js
              }
          } catch (e) {
              console.log('❌ Trade FAILED:', e.message);
          }
      } else {
          console.log('Market is CLOSED, cannot test trade.');
      }

    } else {
      console.log('❌ Could not get GBP/JPY details');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

runDebug();
