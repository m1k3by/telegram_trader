#!/usr/bin/env node

/**
 * 🚀 Quick Test Runner
 * 
 * Führt alle Tests aus ohne npm/package.json
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n🧪 Running Telegram Trader Tests...\n');

// Run Message Parser Tests
console.log('📝 Message Parser Tests:\n');
const parser = spawn('node', [join(__dirname, 'messageParser.test.js')], { stdio: 'inherit' });

parser.on('close', (code1) => {
  if (code1 !== 0) {
    console.log('\n❌ Message Parser Tests failed!\n');
    process.exit(1);
  }
  
  // Run Instrument Mapping Tests
  console.log('\n🗺️  Instrument Mapping Tests:\n');
  const mapping = spawn('node', [join(__dirname, 'instrumentMapping.test.js')], { stdio: 'inherit' });
  
  mapping.on('close', (code2) => {
    if (code2 !== 0) {
      console.log('\n❌ Instrument Mapping Tests failed!\n');
      process.exit(1);
    }
    
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  });
});
