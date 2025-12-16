
import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkSpecificEpic() {
  try {
    await igApi.login();

    const epic = 'CS.D.EURUSD.MINI.IP';
    console.log(`Checking details for ${epic}...`);
    try {
        const details = await igApi.getMarketDetails(epic);
        console.log('Market Details:', details.instrument.name, details.marketStatus);
    } catch (e) {
        console.log('Error fetching details for MINI.IP:', e.message);
    }

    const epic2 = 'CS.D.EURUSD.CEAM.IP';
    console.log(`Checking details for ${epic2}...`);
    try {
        const details = await igApi.getMarketDetails(epic2);
        console.log('Market Details:', details.instrument.name, details.marketStatus);
    } catch (e) {
        console.log('Error fetching details for CEAM.IP:', e.message);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkSpecificEpic();
