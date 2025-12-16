import { igApi } from './src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

async function searchCADJPY() {
  await new Promise(r => setTimeout(r, 2000));
  
  const result = await igApi.searchMarkets('CAD/JPY');
  
  console.log('\n🔍 CAD/JPY Search Results:\n');
  console.log('═'.repeat(70));
  
  result.slice(0, 15).forEach((m, i) => {
    console.log(`\n${i + 1}. ${m.instrumentName || m.epic}`);
    console.log(`   EPIC: ${m.epic}`);
    console.log(`   Type: ${m.instrumentType}`);
  });
  
  console.log('\n═'.repeat(70));
  console.log('\n✅ Checking Mini vs Standard:');
  
  const miniEpic = result.find(m => m.epic.includes('MINI') || m.instrumentName?.includes('Mini'));
  const standardEpic = result.find(m => m.epic.includes('CFD') && !m.epic.includes('MINI'));
  
  if (miniEpic) {
    console.log(`\n📦 MINI: ${miniEpic.epic}`);
    const details = await igApi.getMarketDetails(miniEpic.epic);
    console.log(`   Contract Size: ${details.rawData?.instrument?.contractSize}`);
    console.log(`   Margin: ${details.marginFactor}%`);
  }
  
  if (standardEpic) {
    console.log(`\n📦 STANDARD: ${standardEpic.epic}`);
    const details = await igApi.getMarketDetails(standardEpic.epic);
    console.log(`   Contract Size: ${details.rawData?.instrument?.contractSize}`);
    console.log(`   Margin: ${details.marginFactor}%`);
  }
  
  process.exit(0);
}

searchCADJPY();
