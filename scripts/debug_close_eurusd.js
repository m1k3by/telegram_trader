
import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

async function closePosition() {
  try {
    await igApi.login();
    
    const dealId = 'DIAAAAVWKPCEEBD'; // One of the EUR/USD positions
    console.log(`Attempting to close ${dealId} via DELETE v2...`);

    const response = await fetch(`${igApi.baseUrl}/positions/otc/${dealId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': igApi.apiKey,
          'CST': igApi.cst,
          'X-SECURITY-TOKEN': igApi.securityToken,
          'Version': '2'
        }
    });

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Body:', text);

  } catch (error) {
    console.error('Error:', error);
  }
}

closePosition();
