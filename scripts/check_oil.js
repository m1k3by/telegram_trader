
import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkOil() {
  try {
    await igApi.login();
    
    const epic = 'CC.D.LCO.UNC.IP'; // Oil - Brent Crude
    console.log(`Checking ${epic}...`);
    
    const details = await igApi.getMarketDetails(epic);
    console.log(JSON.stringify(details, null, 2));
    
  } catch (error) {
    console.error(error);
  }
}

checkOil();
