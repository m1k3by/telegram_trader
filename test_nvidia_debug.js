import { igApi } from './src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

const EPIC = 'UC.D.NVDA.CASH.IP'; // The EPIC from the logs

console.log(`🔍 Testing NVIDIA EPIC: ${EPIC}...\n`);

async function testNvidia() {
  try {
    await igApi.login();
    
    console.log(`Fetching details for ${EPIC}...`);
    const marketDetails = await igApi.getMarketDetails(EPIC);
    
    if (marketDetails) {
      console.log('\n✅ Market Details Received:');
      console.log('----------------------------------------');
      console.log('Instrument Name:', marketDetails.name);
      console.log('Type:', marketDetails.type);
      console.log('Market Status:', marketDetails.marketStatus);
      console.log('Currency:', marketDetails.currencyCode);
      console.log('----------------------------------------');
      console.log('PRICES:');
      console.log('  Bid:', marketDetails.bid);
      console.log('  Offer:', marketDetails.offer);
      console.log('  High:', marketDetails.highPrice);
      console.log('  Low:', marketDetails.lowPrice);
      console.log('  Close:', marketDetails.closePrice);
      console.log('----------------------------------------');
      console.log('SIZING & MARGIN:');
      console.log('  Min Deal Size:', marketDetails.minDealSize);
      console.log('  Deal Size Increment:', marketDetails.dealSizeIncrement);
      console.log('  Margin Factor (API):', marketDetails.marginFactor);
      console.log('  Margin Bands:', JSON.stringify(marketDetails.marginDepositBands));
      
      const instrument = marketDetails.rawData?.instrument || {};
      console.log('----------------------------------------');
      console.log('RAW INSTRUMENT DATA:');
      console.log('  Contract Size:', instrument.contractSize);
      console.log('  Lot Size:', instrument.lotSize);
      console.log('  Value of One Pip:', instrument.valueOfOnePip);
      console.log('  One Pip Means:', instrument.onePipMeans);
      console.log('  Currencies:', JSON.stringify(instrument.currencies));
      console.log('----------------------------------------');
      
      // SIMULATE MARGIN CALCULATION
      console.log('\n🧮 MARGIN SIMULATION (Risk 100€):');
      
      const price = marketDetails.offer || marketDetails.bid || 0;
      const marginPercent = 0.20; // Assuming 20% for shares
      const exchangeRate = 0.85; // Approx USD/EUR
      const contractSize = instrument.contractSize || 1;
      
      console.log(`  Price: ${price}`);
      console.log(`  Margin %: ${marginPercent * 100}%`);
      console.log(`  Exchange Rate: ${exchangeRate}`);
      console.log(`  Contract Size: ${contractSize}`);
      
      const marginPerContract = price * marginPercent * exchangeRate * contractSize;
      console.log(`  => Margin per Contract: ${marginPerContract.toFixed(2)}€`);
      
      const riskBudget = 100;
      const calculatedSize = riskBudget / marginPerContract;
      console.log(`  => Calculated Size for 100€: ${calculatedSize.toFixed(2)} contracts`);
      
      // EXECUTE TEST TRADE
      console.log('\n🚀 EXECUTING TEST TRADE (Size 1)...');
      
      // Mock signal object
      const signal = {
          epic: EPIC,
          symbol: 'NVIDIA Corp (24 Hours)',
          direction: 'SELL',
          size: 1,
          currency: 'USD'
      };
      
      // Enable trading temporarily for this test
      igApi.enabled = true;
      
      const tradeResult = await igApi.executeTrade(signal);
      
      console.log('Trade Result:', JSON.stringify(tradeResult, null, 2));
      
    } else {
      console.log('❌ EPIC returned null');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
  
  process.exit(0);
}

testNvidia();
