
import 'dotenv/config';

const IG_API_KEY = process.env.IG_API_KEY;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;
const IG_USERNAME = process.env.IG_USERNAME;
const IG_PASSWORD = process.env.IG_PASSWORD;

async function run() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginResponse = await fetch('https://demo-api.ig.com/gateway/deal/session', {
            method: 'POST',
            headers: {
                'X-IG-API-KEY': IG_API_KEY,
                'Version': '2',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                identifier: IG_USERNAME,
                password: IG_PASSWORD
            })
        });

        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
        }

        const cst = loginResponse.headers.get('cst');
        const xSecurityToken = loginResponse.headers.get('x-security-token');
        
        console.log('Logged in.');

        const epic = 'CS.D.CFDSILVER.CFM.IP';
        console.log(`Fetching details for ${epic}...`);
        
        const marketResponse = await fetch(`https://demo-api.ig.com/gateway/deal/markets/${epic}`, {
            headers: {
                'X-IG-API-KEY': IG_API_KEY,
                'CST': cst,
                'X-SECURITY-TOKEN': xSecurityToken,
                'Version': '3'
            }
        });

        if (!marketResponse.ok) {
            throw new Error(`Market details failed: ${marketResponse.status} ${marketResponse.statusText}`);
        }

        const data = await marketResponse.json();
        const instrument = data.instrument;
        const dealingRules = data.dealingRules;
        const snapshot = data.snapshot;

        console.log('Instrument Details:');
        console.log(JSON.stringify(instrument, null, 2));
        console.log('Dealing Rules:');
        console.log(JSON.stringify(dealingRules, null, 2));
        console.log('Snapshot:');
        console.log(JSON.stringify(snapshot, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

run();
