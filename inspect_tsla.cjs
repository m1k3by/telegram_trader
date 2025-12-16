
require('dotenv').config();
const axios = require('axios');

const IG_API_KEY = process.env.IG_API_KEY;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;
const IG_USERNAME = process.env.IG_USERNAME;
const IG_PASSWORD = process.env.IG_PASSWORD;

async function run() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginResponse = await axios.post('https://demo-api.ig.com/gateway/deal/session', {
            identifier: IG_USERNAME,
            password: IG_PASSWORD
        }, {
            headers: {
                'X-IG-API-KEY': IG_API_KEY,
                'Version': '2'
            }
        });

        const cst = loginResponse.headers['cst'];
        const xSecurityToken = loginResponse.headers['x-security-token'];
        
        console.log('Logged in.');

        // 2. Get Market Details for TSLA
        const epic = 'UD.D.TSLA.CASH.IP';
        console.log(`Fetching details for ${epic}...`);
        
        const marketResponse = await axios.get(`https://demo-api.ig.com/gateway/deal/markets/${epic}`, {
            headers: {
                'X-IG-API-KEY': IG_API_KEY,
                'CST': cst,
                'X-SECURITY-TOKEN': xSecurityToken,
                'Version': '3'
            }
        });

        const instrument = marketResponse.data.instrument;
        const dealingRules = marketResponse.data.dealingRules;
        const snapshot = marketResponse.data.snapshot;

        console.log('Instrument Details:');
        console.log(JSON.stringify(instrument, null, 2));
        console.log('Dealing Rules:');
        console.log(JSON.stringify(dealingRules, null, 2));
        console.log('Snapshot:');
        console.log(JSON.stringify(snapshot, null, 2));

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

run();
