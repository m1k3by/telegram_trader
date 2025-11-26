#!/usr/bin/env node

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const API_ID = parseInt(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const PHONE_NUMBER = process.env.PHONE_NUMBER;
const SESSION_STRING = process.env.SESSION_STRING || '';

async function setupSession() {
  console.log('\n==========================================');
  console.log('   TELEGRAM SESSION AUTO-SETUP');
  console.log('==========================================\n');

  // Check if session already exists
  if (SESSION_STRING && SESSION_STRING.length > 0) {
    console.log('✅ SESSION_STRING already exists in .env file.');
    console.log('   Skipping session generation.\n');
    
    // Test if session is valid
    try {
      const client = new TelegramClient(new StringSession(SESSION_STRING), API_ID, API_HASH, {
        connectionRetries: 2,
      });
      
      console.log('🔄 Testing existing session...');
      await client.connect();
      
      if (client.connected) {
        console.log('✅ Session is valid and working!\n');
        await client.disconnect();
        process.exit(0);
      }
    } catch (error) {
      console.log('⚠️  Existing session is invalid or expired.');
      console.log('   Generating new session...\n');
    }
  } else {
    console.log('⚠️  No SESSION_STRING found in .env file.');
    console.log('   Generating new session...\n');
  }

  // Generate new session
  const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
    connectionRetries: 5,
  });

  console.log('📱 Starting Telegram authentication...\n');

  await client.start({
    phoneNumber: async () => PHONE_NUMBER || await input.text('Please enter your phone number: '),
    password: async () => await input.text('Please enter your 2FA password (if enabled): '),
    phoneCode: async () => await input.text('Please enter the code you received: '),
    onError: (err) => console.error('Authentication error:', err),
  });

  console.log('\n✅ Successfully connected to Telegram!');
  const sessionString = client.session.save();
  
  console.log('💾 Saving session to .env file...');

  // Read .env file
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch (error) {
    console.log('⚠️  .env file not found, creating new one...');
  }

  // Update or add SESSION_STRING
  if (envContent.includes('SESSION_STRING=')) {
    // Replace existing SESSION_STRING
    envContent = envContent.replace(
      /SESSION_STRING=.*/,
      `SESSION_STRING=${sessionString}`
    );
  } else {
    // Add SESSION_STRING at the end
    envContent += `\nSESSION_STRING=${sessionString}\n`;
  }

  // Write back to .env
  fs.writeFileSync(envPath, envContent, 'utf8');

  console.log('✅ Session saved to .env file!\n');
  console.log('==========================================');
  console.log('   SETUP COMPLETE!');
  console.log('==========================================');
  console.log('You can now start the bot with: npm start\n');

  await client.disconnect();
  process.exit(0);
}

setupSession().catch((error) => {
  console.error('\n❌ Error during session setup:', error);
  process.exit(1);
});
