import { igApi } from './src/igApi.js';

async function searchForCrypto() {
  console.log('🔍 Searching for EPICs on IG Markets...\n');
  
  // Get search terms from command line args, or default to list
  const args = process.argv.slice(2);
  const searchTerms = args.length > 0 ? args : ['Gold', 'XAUUSD'];
  
  for (const term of searchTerms) {
    console.log(`\n📊 Searching for: ${term}`);
    console.log('='.repeat(50));
    
    const results = await igApi.searchMarkets(term);
    
    if (results && results.length > 0) {
      console.log(`Found ${results.length} results:\n`);
      
      results.forEach((market, index) => {
        console.log(`${index + 1}. ${market.instrumentName || market.name}`);
        console.log(`   EPIC: ${market.epic}`);
        console.log(`   Type: ${market.instrumentType || market.type}`);
        console.log(`   Expiry: ${market.expiry || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('❌ No results found');
    }
  }
  
  console.log('\n✅ Search complete!');
}

searchForCrypto().catch(error => {
  console.error('❌ Error:', error.message);
});
