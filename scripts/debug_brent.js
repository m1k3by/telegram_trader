
import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkBrent() {
  try {
    await igApi.login();
    console.log('Logged in.');

    const epic = 'CC.D.LCO.UNC.IP';
    console.log(`Fetching details for ${epic}...`);
    
    const details = await igApi.getMarketDetails(epic);
    console.log('Market Details:', JSON.stringify(details, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkBrent();
