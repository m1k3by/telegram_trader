import { igApi } from '../src/igApi.js';

console.log('🔍 Debugging Bitcoin Cash margin...\n');

await igApi.login();
const details = await igApi.getMarketDetails('CS.D.BCHUSD.CFD.IP');

console.log('marginFactor:', details.marginFactor);
console.log('marginDepositBands:', JSON.stringify(details.marginDepositBands, null, 2));
console.log('\nIf marginFactor = 5000:');
console.log('  → 5000 / 100 = 50 (50%)');
console.log('  → 5000 / 10000 = 0.5 (0.5%)');

process.exit(0);
