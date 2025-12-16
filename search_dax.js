import { igApi } from './src/igApi.js';

console.log('\n🔐 Logging in to IG API...');
await igApi.login();

console.log('\n📊 Searching for Germany 40 contracts...\n');

const results = await igApi.searchMarkets('Germany 40');

if (results && results.length > 0) {
  console.log(`Found ${results.length} results:\n`);
  
  for (let i = 0; i < results.length; i++) {
    const market = results[i];
    console.log(`${i + 1}. ${market.instrumentName}`);
    console.log(`   EPIC: ${market.epic}`);
    console.log(`   Type: ${market.instrumentType}`);
    console.log(`   Expiry: ${market.expiry || '-'}`);
    
    // Get market details to see min size
    try {
      const details = await igApi.getMarketDetails(market.epic);
      if (details) {
        console.log(`   Min Size: ${details.minDealSize}`);
        console.log(`   Increment: ${details.dealSizeIncrement}`);
        console.log(`   Status: ${details.marketStatus}`);
      }
    } catch (e) {
      console.log(`   (Could not fetch details)`);
    }
    console.log('');
  }
} else {
  console.log('No results found.');
}

console.log('✅ Search complete!');
process.exit(0);
