
import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkForex() {
  try {
    await igApi.login();

    const pairs = ['EURUSD', 'GBPUSD', 'USDJPY'];
    
    for (const pair of pairs) {
        console.log(`Searching for ${pair}...`);
        const results = await igApi.searchMarkets(pair);
        
        console.log(`Results for ${pair}:`);
        results.forEach(r => {
            if (r.instrumentName.includes('Mini') || r.epic.includes('MINI')) {
                console.log(`  FOUND MINI: ${r.instrumentName} (${r.epic})`);
            } else {
                console.log(`  Other: ${r.instrumentName} (${r.epic})`);
            }
        });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkForex();
