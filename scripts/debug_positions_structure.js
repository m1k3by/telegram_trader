
import { igApi } from '../src/igApi.js';

async function debugPositions() {
  try {
    console.log('Logging in...');
    await igApi.login();
    
    console.log('Fetching positions...');
    const positions = await igApi.getOpenPositions();
    
    console.log('Positions found:', positions.length);
    
    if (positions.length > 0) {
      console.log('First position structure:');
      console.log(JSON.stringify(positions[0], null, 2));
    } else {
      console.log('No positions to inspect.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugPositions();
