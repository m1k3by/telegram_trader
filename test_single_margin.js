/**
 * Test single EPIC to see the actual response structure
 */

import { igApi } from './src/igApi.js';

async function testSingleEpic() {
  console.log('🔐 Logging in...');
  await igApi.login();
  
  console.log('\n📊 Testing DAX EPIC...');
  
  // Try the EPIC that we know works from logs
  const testEpics = [
    'IX.D.DAX.IFMM.IP',
    'IX.D.SUNDAX.IGN.IP',  // Weekend DAX
  ];
  
  for (const epic of testEpics) {
    console.log(`\n--- Testing: ${epic} ---`);
    try {
      const details = await igApi.getMarketDetails(epic);
      console.log('Full response:', JSON.stringify(details, null, 2));
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

testSingleEpic();
