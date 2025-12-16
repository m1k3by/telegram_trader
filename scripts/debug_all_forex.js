
import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkAllForex() {
  try {
    await igApi.login();

    const pairs = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 
      'EURGBP', 'EURJPY', 'GBPJPY', 'CADJPY', 'GBPZAR', 'NZDCAD'
    ];
    
    for (const pair of pairs) {
        // Format as "EUR/USD" for search
        const searchName = pair.substring(0, 3) + '/' + pair.substring(3);
        console.log(`Searching for ${searchName}...`);
        
        const results = await igApi.searchMarkets(searchName);
        const mini = results.find(r => r.instrumentName.includes('Mini') || r.epic.includes('MINI') || r.epic.includes('CEAM'));
        
        if (mini) {
            console.log(`✅ ${pair}: ${mini.instrumentName} (${mini.epic})`);
        } else {
            console.log(`❌ ${pair}: No Mini found. Top result: ${results[0]?.instrumentName} (${results[0]?.epic})`);
        }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllForex();
