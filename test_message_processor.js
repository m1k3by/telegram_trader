import { extractTradingSignal } from './src/messageProcessor.js';

console.log('🧪 Testing Message Processor with German Patterns\n');

const testMessages = [
  'ICH KAUFE BROADCOM (EK: 360.24)',
  'ICH KAUFE NETFLIX (EK: 106.14)',
  'ICH KAUFE TESLA CALL 410 (EK: 4.70)',
  'ICH KAUFE APPLE (EK: 195.50)',
  'ICH KAUFE MICROSOFT CALL 450 (EK: 12.30)',
  'ICH KAUFE NVIDIA (EK: 520.00)',
  'BUY EURUSD @ 1.0850',  // English fallback test
];

testMessages.forEach((message, index) => {
  console.log(`\n--- Test ${index + 1} ---`);
  console.log(`Message: "${message}"`);
  
  const signal = extractTradingSignal(message);
  
  if (signal) {
    console.log('✅ Signal Extracted:');
    console.log(`   Action: ${signal.action}`);
    console.log(`   Symbol: ${signal.symbol}`);
    console.log(`   Price: ${signal.price}`);
    if (signal.isOption) {
      console.log(`   Option Type: CALL`);
      console.log(`   Strike Price: ${signal.strikePrice}`);
    }
  } else {
    console.log('❌ No signal extracted');
  }
});

console.log('\n\n🎯 Summary:');
console.log('All German "ICH KAUFE" patterns should be recognized');
console.log('Options (CALL) should have strikePrice field');
console.log('Regular stocks should not have strikePrice field');
