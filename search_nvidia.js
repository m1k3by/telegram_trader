import { igApi } from './src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Searching for NVIDIA in IG Markets...\n');

async function searchNvidia() {
  try {
    // Search for NVIDIA
    const searchTerm = 'NVIDIA';
    console.log(`Searching for: "${searchTerm}"\n`);
    
    const results = await igApi.searchMarkets(searchTerm);
    
    if (results && results.length > 0) {
      console.log(`✅ Found ${results.length} result(s):\n`);
      
      results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.instrumentName}`);
        console.log(`   EPIC: ${result.epic}`);
        console.log(`   Type: ${result.instrumentType}`);
        console.log(`   Expiry: ${result.expiry || 'N/A'}`);
        console.log('');
      });
      
      // Test the first result
      if (results[0]) {
        console.log(`\n🔍 Testing first result: ${results[0].epic}\n`);
        const details = await igApi.getMarketDetails(results[0].epic);
        
        if (details) {
          console.log('✅ Market Details:');
          console.log('  Status:', details.marketStatus);
          console.log('  Bid:', details.bid);
          console.log('  Offer:', details.offer);
          console.log('  Min Size:', details.minSize);
          console.log('  Margin:', details.marginFactor + '%');
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

searchNvidia();
