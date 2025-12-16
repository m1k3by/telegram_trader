
import { parseLiveTrend } from '../src/trendAnalyzer.js';

const msg15 = `> Trading Coach:
📊 Photo

🚦LIVE TREND🚦
ICH VERKAUFE DAX (EK: 23935.9) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`;

const msg18 = `> Trading Coach:
🚦LIVE TREND🚦
ICH VERKAUFE GBP/JPY (EK: 205.344) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`;

console.log("--- Testing Message 15 (DAX) ---");
const trend15 = parseLiveTrend(msg15);
console.log("Type:", trend15.type);
console.log("Data:", JSON.stringify(trend15.data, null, 2));

console.log("\n--- Testing Message 18 (GBP/JPY) ---");
const trend18 = parseLiveTrend(msg18);
console.log("Type:", trend18.type);
console.log("Data:", JSON.stringify(trend18.data, null, 2));
