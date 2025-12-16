import { igApi } from '../src/igApi.js';
import fetch from 'node-fetch';

async function debugMarkets() {
  console.log('🔍 Debugging Market Details...');
  
  // Wait for login
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const epics = [
    'IX.D.DAX.IFMM.IP', // Working DAX
    'CC.D.LCO.UNC.IP'   // Failing Brent
  ];

  for (const epic of epics) {
    console.log(`\n----------------------------------------`);
    console.log(`Checking EPIC: ${epic}`);
    try {
      // Fetch directly to see full structure
      const response = await fetch(`${igApi.baseUrl}/markets/${epic}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': igApi.apiKey,
          'CST': igApi.cst,
          'X-SECURITY-TOKEN': igApi.securityToken,
          'Version': '3'
        }
      });
      
      const data = await response.json();
      console.log('✅ Raw Market Data:');
      console.log(JSON.stringify(data, null, 2));
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
  
  process.exit(0);
}

debugMarkets();
