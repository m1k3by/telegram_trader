
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import dotenv from 'dotenv';

dotenv.config();

const API_ID = parseInt(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const PHONE_NUMBER = process.env.PHONE_NUMBER;

async function generateSession() {
  console.log('==========================================');
  console.log('   TELEGRAM SESSION GENERATOR');
  console.log('==========================================\n');
  console.log('This script will generate a NEW session string for your local machine.');
  console.log('You can use this new session to run the bot locally while the server runs separately.\n');

  const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => PHONE_NUMBER || await input.text('Please enter your phone number: '),
    password: async () => await input.text('Please enter your 2FA password (if enabled): '),
    phoneCode: async () => await input.text('Please enter the code you received: '),
    onError: (err) => console.error('Authentication error:', err),
  });

  console.log('\n✅ Successfully connected to Telegram!');
  const sessionString = client.session.save();
  
  console.log('\n==========================================');
  console.log('   YOUR NEW SESSION STRING');
  console.log('==========================================\n');
  console.log(sessionString);
  console.log('\n==========================================');
  console.log('INSTRUCTIONS:');
  console.log('1. Copy the string above.');
  console.log('2. Open your local .env file.');
  console.log('3. Replace the value of SESSION_STRING with this new string.');
  console.log('4. Restart the bot locally.');
  console.log('==========================================\n');

  await client.disconnect();
  process.exit(0);
}

generateSession().catch(console.error);
