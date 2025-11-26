
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import dotenv from 'dotenv';
import input from 'input';

dotenv.config();

const API_ID = parseInt(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const SESSION_STRING = process.env.SESSION_STRING;

// List of chats to validate
const CHATS_TO_TEST = ["Trading Coach"];

async function runTest() {
  console.log('🧪 STARTING CHAT ACCESS TEST');
  console.log('==========================================');
  
  const client = new TelegramClient(
    new StringSession(SESSION_STRING),
    API_ID,
    API_HASH,
    { connectionRetries: 5 }
  );

  try {
      await client.start({
        phoneNumber: async () => process.env.PHONE_NUMBER,
        password: async () => await input.text('Password: '),
        phoneCode: async () => await input.text('Code: '),
        onError: (err) => console.log(err),
      });
      console.log('✅ Telegram Connection: SUCCESS');
  } catch (e) {
      console.error('❌ Telegram Connection: FAILED', e);
      process.exit(1);
  }

  console.log('\n🔍 Validating Chat Access...');
  
  const dialogs = await client.getDialogs({});
  let allPassed = true;

  for (const chatName of CHATS_TO_TEST) {
      process.stdout.write(`Testing access to "${chatName}"... `);
      
      const chat = dialogs.find(d => d.title === chatName);
      
      if (!chat) {
          console.log('❌ FAILED (Chat not found in dialog list)');
          allPassed = false;
          continue;
      }

      try {
          // Try to read 1 message to verify read access
          const messages = await client.getMessages(chat.entity, { limit: 1 });
          console.log(`✅ SUCCESS (Found ID: ${chat.id}, Read ${messages.length} msg)`);
      } catch (error) {
          console.log(`❌ FAILED (Error reading messages: ${error.message})`);
          allPassed = false;
      }
  }

  console.log('\n==========================================');
  if (allPassed) {
      console.log('✅ ALL TESTS PASSED');
  } else {
      console.log('❌ SOME TESTS FAILED');
  }
  
  await client.disconnect();
  process.exit(allPassed ? 0 : 1);
}

runTest().catch(console.error);
