
import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkDax() {
  try {
    // await igApi.init();
    await igApi.login();

    const epic = 'IX.D.DAX.IFMM.IP';
    console.log(`Checking details for ${epic}...`);

    const details = await igApi.getMarketDetails(epic);
    console.log('Market Details:', JSON.stringify(details, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

checkDax();
