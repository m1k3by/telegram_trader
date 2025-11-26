import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import dotenv from 'dotenv';
import input from 'input';

dotenv.config();

const API_ID = parseInt(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const SESSION_STRING = process.env.SESSION_STRING;

async function listChats() {
  console.log('Connecting to Telegram...');
  
  const client = new TelegramClient(
    new StringSession(SESSION_STRING),
    API_ID,
    API_HASH,
    { connectionRetries: 5 }
  );

  await client.start({
    phoneNumber: async () => process.env.PHONE_NUMBER,
    password: async () => await input.text('Password: '),
    phoneCode: async () => await input.text('Code: '),
    onError: (err) => console.log(err),
  });

  console.log('Connected! Fetching dialogs...\n');

  const dialogs = await client.getDialogs({});

  console.log('📋 YOUR CHATS:');
  console.log('==========================================');
  
  dialogs.forEach(dialog => {
    // Filter only channels and groups usually
    if (dialog.isChannel || dialog.isGroup) {
      console.log(`Name: "${dialog.title}"`);
      console.log(`ID:   ${dialog.id}`);
      console.log('------------------------------------------');
    }
  });
  
  console.log('\n✅ Done. Copy the exact name from above into your .env file.');
  await client.disconnect();
}

listChats().catch(console.error);
