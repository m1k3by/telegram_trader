import { parseLiveTrend } from './src/trendAnalyzer.js';

console.log('🧪 Testing Stop Loss Updates with Options\n');

const testMessages = [
  'Ich setze den SL bei TESLA PUT 390 auf 28.99',
  'Ich setze den SL bei BITCOIN auf 84376.00',
  'SL bei GOLD auf 2000.50',
  'Ich setze den SL bei NETFLIX CALL 500 auf 15.20'
];

testMessages.forEach((message, index) => {
  console.log(`\n--- Test ${index + 1} ---`);
  console.log(`Message: "${message}"`);
  
  const trend = parseLiveTrend(message);
  
  if (trend.type === 'STOP_LOSS_UPDATE') {
    console.log('✅ SL Update Detected:');
    console.log(`   Symbol: ${trend.data.symbol}`);
    console.log(`   New SL: ${trend.data.stopLoss}`);
    if (trend.data.isOption) {
      console.log(`   Option: ${trend.data.optionType} ${trend.data.strikePrice}`);
    }
  } else {
    console.log('❌ Failed to detect SL update');
    console.log(`   Detected Type: ${trend.type}`);
  }
});
