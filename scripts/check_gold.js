
import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkGold() {
  try {
    await igApi.login();
    
    const epic = 'CS.D.CFEGOLD.CEA.IP'; // Gold
    console.log(`Checking ${epic}...`);
    
    const details = await igApi.getMarketDetails(epic);
    console.log(JSON.stringify(details, null, 2));
    
  } catch (error) {
    console.error(error);
  }
}

checkGold();
