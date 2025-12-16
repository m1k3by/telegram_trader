
import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkEurGbp() {
  try {
    await igApi.login();

    const epic = 'CS.D.EURGBP.MINI.IP';
    console.log(`Checking details for ${epic}...`);
    try {
        const details = await igApi.getMarketDetails(epic);
        if (details) {
            console.log('✅ Found:', details.name);
        } else {
            console.log('❌ Not found (undefined)');
        }
    } catch (e) {
        console.log('❌ Error:', e.message);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkEurGbp();
