/**
 * Test improved logging for FOREX margin calculation
 */

// Simulate GBP/JPY calculation
console.log('🧪 Testing improved margin calculation logs\n');
console.log('═'.repeat(70));

const entryPrice = 205.872;
const currency = 'JPY';
const marginPercent = 0.0333;
const exchangeRate = 0.00555;
const contractSize = 100000;
const riskAmount = 100;

console.log('\n📊 FOREX Pair: GBP/JPY');
console.log('─'.repeat(70));

console.log('\n💱 Quote Currency: JPY');
console.log('💱 Exchange Rate: 1 JPY = 0.00555 EUR');

console.log('\n📦 Contract Size: 100000 units');
console.log('📦 Lot Size: 1000');

console.log('\n🔍 Margin Calculation Breakdown:');
console.log(`   Entry Price: ${entryPrice} JPY (per 1 unit of base currency)`);
console.log(`   Margin%: ${(marginPercent * 100).toFixed(2)}%`);
console.log(`   Exchange Rate: 1 JPY = ${exchangeRate} EUR`);
console.log(`   Contract Size: ${contractSize} units`);
console.log(`   → Formula: ${entryPrice} × ${(marginPercent * 100).toFixed(2)}% × ${exchangeRate} × ${contractSize}`);

const marginPerContract = entryPrice * marginPercent * exchangeRate * contractSize;
console.log(`   → Margin per Contract: ${marginPerContract.toFixed(2)}€`);

const tradeSize = riskAmount / marginPerContract;
console.log(`\n📊 Trade Size Calculation:`);
console.log(`   Desired Risk: ${riskAmount}€`);
console.log(`   Margin per Contract: ${marginPerContract.toFixed(2)}€`);
console.log(`   → Trade Size: ${riskAmount}€ / ${marginPerContract.toFixed(2)}€ = ${tradeSize.toFixed(4)} contracts`);
console.log(`   → Rounded to minimum: 0.1 contracts`);

const realRisk = 0.1 * marginPerContract;
console.log(`\n🛡️ Security Gate Check:`);
console.log(`   Real Risk: 0.1 × ${marginPerContract.toFixed(2)}€ = ${realRisk.toFixed(2)}€`);
console.log(`   Max Allowed: ${riskAmount * 3}€ (300%)`);
console.log(`   Result: ${realRisk <= riskAmount * 3 ? '✅ PASSED' : '🚨 REJECTED'}`);

console.log('\n═'.repeat(70));
console.log('✅ Logs sind jetzt klarer:');
console.log('   - "205.872 JPY (per 1 unit of base currency)" statt nur "205.872 JPY"');
console.log('   - "1 JPY = 0.00555 EUR" statt nur "0.00555"');
console.log('   - Komplette Formel sichtbar');
console.log('═'.repeat(70));
