
import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkPositions() {
  try {
    await igApi.login();
    console.log('Logged in.');

    const positions = await igApi.getOpenPositions();
    console.log(`Found ${positions.length} positions.`);
    
    if (positions.length > 0) {
      console.log('First position structure:', JSON.stringify(positions[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPositions();
