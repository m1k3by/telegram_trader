
import { igApi } from './src/igApi.js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.live explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.live') });

// Force LIVE mode
process.env.IG_DEMO_MODE = 'false';

async function checkBrent() {
  try {
    console.log('Logging in with .env.live credentials...');
    await igApi.login();

    console.log('Searching for Brent...');
    const searchResults = await igApi.searchMarket('Brent Crude');
    console.log('Search Results:', searchResults);
    
    // Try to find the specific EPIC if search returns multiple
    // Common EPICs: CC.D.LCO.USS.IP (Cash), CC.D.LCO.UME.IP (Future)
    let epic = 'CC.D.LCO.USS.IP'; // Force Cash
    
    console.log(`Checking details for ${epic}...`);

    const details = await igApi.getMarketDetails(epic);
    console.log('Market Details:', JSON.stringify(details, null, 2));
    
    if (details && details.dealingRules) {
        console.log('\nDealing Rules:');
        console.log('Min Deal Size:', details.dealingRules.minDealSize);
        console.log('Min Step Distance:', details.dealingRules.minStepDistance);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkBrent();
