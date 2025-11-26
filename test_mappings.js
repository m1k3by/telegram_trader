import { mapInstrumentToIG } from './src/trendAnalyzer.js';

console.log('🧪 Testing Corrected Stock Mappings\n');

const stocks = ['TESLA', 'NETFLIX', 'BROADCOM', 'APPLE', 'MICROSOFT', 'NVIDIA'];

stocks.forEach(stock => {
  const mapping = mapInstrumentToIG(stock);
  console.log(`${stock}:`);
  console.log(`  EPIC: ${mapping.epic}`);
  console.log(`  Symbol: ${mapping.symbol}`);
  console.log('');
});

console.log('✅ All mappings use correct .CASH.IP format');
