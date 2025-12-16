import { igApi } from '../src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkContractSizes() {
  await new Promise(r => setTimeout(r, 2000));
  
  const pairs = [
    'CS.D.GBPJPY.CFD.IP',
    'CS.D.CADJPY.CFD.IP', 
    'CS.D.NZDCAD.MINI.IP'
  ];
  
  for (const epic of pairs) {
    const d = await igApi.getMarketDetails(epic);
    console.log(`\n${d.name}:`);
    console.log(`  Contract Size: ${d.rawData?.instrument?.contractSize}`);
    console.log(`  Lot Size: ${d.rawData?.instrument?.lotSize}`);
    console.log(`  Value of One Pip: ${d.rawData?.instrument?.valueOfOnePip}`);
    console.log(`  One Pip Means: ${d.rawData?.instrument?.onePipMeans}`);
    console.log(`  Margin Factor: ${d.marginFactor}%`);
    console.log(`  Currency: ${d.currencyCode}`);
  }
  
  process.exit(0);
}

checkContractSizes();
