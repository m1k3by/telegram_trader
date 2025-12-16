#!/usr/bin/env node

/**
 * 🧪 Telegram Trader Test Suite Runner
 * 
 * Führt alle Unit Tests aus und gibt einen Gesamtbericht
 * 
 * Usage:
 *   npm test                  # Alle Tests
 *   npm run test:parser       # Nur Message Parser Tests
 *   npm run test:mapping      # Nur Instrument Mapping Tests
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tests = [
  {
    name: '📝 Message Parser Tests',
    script: join(__dirname, 'messageParser.test.js')
  },
  {
    name: '🗺️  Instrument Mapping Tests',
    script: join(__dirname, 'instrumentMapping.test.js')
  }
];

let totalPassed = 0;
let totalFailed = 0;
let failedSuites = [];

console.log('\n');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     🧪 TELEGRAM TRADER UNIT TEST SUITE                    ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('\n');

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n🚀 Running: ${test.name}\n`);
    console.log('─'.repeat(60));
    
    const child = spawn('node', [test.script], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, name: test.name });
      } else {
        failedSuites.push(test.name);
        resolve({ success: false, name: test.name });
      }
    });
  });
}

async function runAllTests() {
  const startTime = Date.now();
  
  for (const test of tests) {
    await runTest(test);
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     📊 FINAL TEST SUMMARY                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log(`⏱️  Total Duration: ${duration}s`);
  console.log(`✅ Test Suites Passed: ${tests.length - failedSuites.length}/${tests.length}`);
  
  if (failedSuites.length > 0) {
    console.log(`❌ Failed Suites:`);
    failedSuites.forEach(suite => {
      console.log(`   - ${suite}`);
    });
    console.log('\n');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TEST SUITES PASSED! 🎉\n');
    process.exit(0);
  }
}

runAllTests();
