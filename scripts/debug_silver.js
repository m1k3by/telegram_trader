
import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkSilver() {
  try {
    await igApi.login();

    console.log(`Searching for Silver...`);
    const results = await igApi.searchMarkets('Silver');
    
    console.log(`Results for Silver:`);
    results.forEach(r => {
        console.log(`  ${r.instrumentName} (${r.epic}) - Type: ${r.instrumentType}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkSilver();
