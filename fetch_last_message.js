
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import dotenv from 'dotenv';
import input from 'input';

dotenv.config();

const API_ID = parseInt(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const SESSION_STRING = process.env.SESSION_STRING;
const TARGET_CHAT_NAME = "Trading Coach";

async function fetchLastMessage() {
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

  console.log(`Connected! Searching for chat "${TARGET_CHAT_NAME}"...\n`);

  const dialogs = await client.getDialogs({});
  const chat = dialogs.find(d => d.title === TARGET_CHAT_NAME);

  if (!chat) {
      console.log(`❌ Chat "${TARGET_CHAT_NAME}" not found in your dialogs.`);
      console.log("Available chats:");
      dialogs.forEach(d => console.log(`- ${d.title}`));
  } else {
      console.log(`✅ Found chat: ${chat.title} (ID: ${chat.id})`);
      console.log("Fetching last message...");
      
      const messages = await client.getMessages(chat.entity, { limit: 1 });
      
      if (messages && messages.length > 0) {
          const msg = messages[0];
          console.log("\n==========================================");
          console.log(`DATE: ${new Date(msg.date * 1000).toLocaleString()}`);
          console.log("CONTENT:");
          console.log(msg.text || "(No text content)");
          console.log("==========================================\n");
      } else {
          console.log("⚠️ No messages found in this chat.");
      }
  }
  
  await client.disconnect();
}

fetchLastMessage().catch(console.error);
