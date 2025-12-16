
import dotenv from 'dotenv';
import { igApi } from './src/igApi.js';
import { calculateContractSize } from './src/contractHelper.js';

dotenv.config();

async function debugContractSize() {
  try {
    await igApi.login();
    console.log('✅ Connected to IG');

    // Search for "US Tech 100" and list ALL variants to find the 100$ one
    const search = await igApi.searchMarkets("US Tech 100");
    
    if (search && search.markets) {
        console.log(`Found ${search.markets.length} markets.`);
        for (const m of search.markets) {
            console.log(`\nEPIC: ${m.epic}`);
            console.log(`Name: ${m.instrumentName}`);
            
            try {
                const details = await igApi.getMarketDetails(m.epic);
                console.log(`Contract Size: ${details.instrument.contractSize}`);
                console.log(`One Pip Means: ${details.instrument.onePipMeans}`);
                
                const calculated = calculateContractSize({ rawData: { instrument: details.instrument } });
                console.log(`Calculated Size: ${calculated}`);
            } catch (e) {
                console.log(`Error: ${e.message}`);
            }
        }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

debugContractSize();
