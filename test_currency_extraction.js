/**
 * Test currency extraction from instrument names
 */

// Helper function (same as in dashboard.js)
function extractQuoteCurrency(instrumentName) {
  if (instrumentName.includes('/')) {
    const parts = instrumentName.split('/');
    if (parts.length === 2) {
      return parts[1].trim().replace(/\s+Mini$/i, '').replace(/\s+Kassa$/i, '');
    }
  }
  return null;
}

console.log('🧪 Testing Quote Currency Extraction\n');
console.log('═'.repeat(70));

const testCases = [
  'GBP/JPY Mini',
  'GBP/ZAR Mini',
  'NZD/CAD Mini',
  'CAD/JPY Mini',
  'EUR/USD Mini',
  'GBP/JPY Kassa',
  'Gold Kassa ($1 Kontrakt)',
  'Germany 40',
  'US Tech 100'
];

for (const name of testCases) {
  const currency = extractQuoteCurrency(name);
  console.log(`${name.padEnd(30)} → ${currency || 'null (not FOREX)'}`);
}

console.log('\n═'.repeat(70));
console.log('\n✅ Expected Results:');
console.log('   GBP/JPY Mini → JPY');
console.log('   GBP/ZAR Mini → ZAR');
console.log('   NZD/CAD Mini → CAD');
console.log('   Gold → null (not FOREX)');
console.log('═'.repeat(70));
