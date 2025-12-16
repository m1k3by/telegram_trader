
import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function listPositions() {
  try {
    await igApi.login();
    const positions = await igApi.getOpenPositions();
    
    console.log(`Found ${positions.length} open positions:`);
    positions.forEach(p => {
        console.log(`- ${p.market.instrumentName}`);
        console.log(`  Epic: ${p.market.epic}`);
        console.log(`  Deal ID: ${p.position.dealId}`);
        console.log(`  Size: ${p.position.size}`);
        console.log(`  Direction: ${p.position.direction}`);
        console.log('---');
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

listPositions();
