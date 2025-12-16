import { igApi } from './src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Searching for BRENT Oil contracts...\n');

async function searchBrent() {
  try {
    const searchTerm = 'Brent';
    console.log(`Searching for: "${searchTerm}"\n`);
    
    const results = await igApi.searchMarkets(searchTerm);
    
    if (results && results.length > 0) {
      console.log(`✅ Found ${results.length} result(s):\n`);
      
      results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.instrumentName}`);
        console.log(`   EPIC: ${result.epic}`);
        console.log(`   Type: ${result.instrumentType}`);
        console.log(`   Expiry: ${result.expiry || 'DFB'}`);
        console.log('');
      });
      
      // Test each result to find contract sizes
      for (const result of results.slice(0, 5)) {
        console.log(`\n🔍 Testing: ${result.epic} - ${result.instrumentName}`);
        const details = await igApi.getMarketDetails(result.epic);
        
        if (details && details.rawData?.instrument) {
          console.log(`  Contract Size: ${details.rawData.instrument.contractSize || 'N/A'}`);
          console.log(`  Lot Size: ${details.rawData.instrument.lotSize || 'N/A'}`);
          console.log(`  Min Size: ${details.minSize}`);
          console.log(`  Margin: ${details.marginFactor}%`);
          console.log(`  Status: ${details.marketStatus}`);
        }
      }
    } else {
      console.log('❌ No results found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

searchBrent();
