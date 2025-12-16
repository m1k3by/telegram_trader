import { igApi } from './src/igApi.js';

console.log('🔍 Searching for EUR/USD EPICs...\n');

await igApi.login();

const results = await igApi.searchMarkets('EUR USD');

console.log(`Found ${results.length} results:\n`);

results.forEach((market, index) => {
  console.log(`${index + 1}. ${market.instrumentName}`);
  console.log(`   EPIC: ${market.epic}`);
  console.log(`   Type: ${market.instrumentType}`);
  console.log(`   Expiry: ${market.expiry}`);
  console.log('');
});
