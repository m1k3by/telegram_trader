
import { igApi } from './src/igApi.js';

async function searchDax() {
  try {
    console.log('Logging in...');
    await igApi.login();
    
    console.log('Searching for "Deutschland 40"...');
    const markets = await igApi.searchMarkets('Deutschland 40');
    
    console.log('\nFound markets:');
    markets.forEach(m => {
      console.log(`- ${m.instrumentName} (EPIC: ${m.epic})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

searchDax();
