import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.live explicitly
const envPath = path.join(__dirname, '.env.live');
if (fs.existsSync(envPath)) {
    console.log(`Loading config from ${envPath}`);
    dotenv.config({ path: envPath });
} else {
    console.error(`Error: ${envPath} not found!`);
    process.exit(1);
}

const IG_API_KEY = process.env.IG_API_KEY;
const IG_USERNAME = process.env.IG_USERNAME;
const IG_PASSWORD = process.env.IG_PASSWORD;
const IG_ENV = process.env.IG_ENV || 'LIVE';

console.log('------------------------------------------------');
console.log('IG MARKETS LOGIN CHECK');
console.log('------------------------------------------------');
console.log(`Environment: ${IG_ENV}`);
console.log(`Username:    ${IG_USERNAME}`);
console.log(`API Key:     ${IG_API_KEY ? '***' + IG_API_KEY.slice(-4) : 'MISSING'}`);
console.log(`Password:    ${IG_PASSWORD ? '******' : 'MISSING'}`);
console.log('------------------------------------------------');

if (!IG_API_KEY || !IG_USERNAME || !IG_PASSWORD) {
    console.error('❌ Missing credentials in .env.live');
    process.exit(1);
}

const BASE_URL = IG_ENV === 'LIVE' ? 'https://api.ig.com/gateway/deal' : 'https://demo-api.ig.com/gateway/deal';

async function checkLogin() {
    try {
        console.log(`Attempting login to ${BASE_URL}/session...`);
        
        const response = await fetch(`${BASE_URL}/session`, {
            method: 'POST',
            headers: {
                'X-IG-API-KEY': IG_API_KEY,
                'Content-Type': 'application/json',
                'Version': '2'
            },
            body: JSON.stringify({
                identifier: IG_USERNAME,
                password: IG_PASSWORD
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('\n✅ LOGIN SUCCESSFUL!');
            console.log('------------------------------------------------');
            console.log(`Account ID:   ${data.currentAccountId}`);
            console.log(`Client ID:    ${data.clientId}`);
            console.log(`Timezone:     ${data.timezoneOffset}`);
            console.log(`Lightstreamer: ${data.lightstreamerEndpoint}`);
            console.log('------------------------------------------------');
            console.log('You can now start the bot safely.');
        } else {
            console.error('\n❌ LOGIN FAILED');
            console.error('------------------------------------------------');
            console.error(`Status Code: ${response.status}`);
            console.error(`Error Code:  ${data.errorCode}`);
            console.error('------------------------------------------------');
            
            if (data.errorCode === 'error.security.client-suspended') {
                console.error('⚠️ ACCOUNT SUSPENDED: Too many failed attempts. Wait or unlock via website.');
            } else if (data.errorCode === 'error.security.invalid-details') {
                console.error('⚠️ INVALID CREDENTIALS: Check username, password, or API key.');
            }
        }

    } catch (error) {
        console.error('\n❌ NETWORK/SCRIPT ERROR');
        console.error(error);
    }
}

checkLogin();
