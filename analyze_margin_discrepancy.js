/**
 * Vergleich: Meine Berechnung vs. IG Reality
 */

console.log('🔍 MARGIN CALCULATION COMPARISON\n');
console.log('═'.repeat(70));

// Deine IG-Werte für 0.3 Kontrakte GBP/JPY
const igMarginEUR = 113.56;
const igMarginJPY = 20560;
const tradeSize = 0.3;
const entryPrice = 205.807;
const marginPercent = 0.0333;
const exchangeRate = 0.00555;

console.log('\n📊 DEINE IG-WERTE (0.3 Kontrakte GBP/JPY):');
console.log(`   Margin: ${igMarginEUR}€ = ${igMarginJPY} JPY`);
console.log(`   Trade Size: ${tradeSize} contracts`);
console.log(`   Entry Price: ${entryPrice} JPY`);

console.log('\n🔢 RÜCKRECHNUNG - Was ist der Contract Size?');

// Pro Kontrakt
const marginPerContractJPY = igMarginJPY / tradeSize;
const marginPerContractEUR = igMarginEUR / tradeSize;

console.log(`\n   Margin pro 1 Kontrakt: ${marginPerContractEUR.toFixed(2)}€ = ${marginPerContractJPY.toFixed(0)} JPY`);

// Contract Size herausfinden
const contractSizeNeeded = marginPerContractJPY / (entryPrice * marginPercent);

console.log(`\n   Contract Size (rückgerechnet):`);
console.log(`   = ${marginPerContractJPY.toFixed(0)} / (${entryPrice} × ${(marginPercent * 100).toFixed(2)}%)`);
console.log(`   = ${marginPerContractJPY.toFixed(0)} / ${(entryPrice * marginPercent).toFixed(3)}`);
console.log(`   = ${contractSizeNeeded.toFixed(0)} units`);

console.log('\n═'.repeat(70));
console.log('\n📋 ERKENNTNISSE:');
console.log(`   API sagt: contractSize = 100,000`);
console.log(`   IG verwendet: contractSize = ${contractSizeNeeded.toFixed(0)}`);
console.log(`   Faktor: ${(100000 / contractSizeNeeded).toFixed(1)}x`);

console.log('\n💡 LÖSUNG:');
if (contractSizeNeeded < 100000) {
  console.log(`   ✅ Contract Size muss durch ${(100000 / contractSizeNeeded).toFixed(0)} geteilt werden!`);
  console.log(`   → Verwende: contractSize = ${100000} / ${(100000 / contractSizeNeeded).toFixed(0)} = ${contractSizeNeeded.toFixed(0)}`);
}

console.log('\n═'.repeat(70));
