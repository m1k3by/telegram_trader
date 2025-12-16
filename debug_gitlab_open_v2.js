
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

        const epic = 'UB.D.GTLBUS.CASH.IP';
        
        // 2. Get Market Details
        console.log(`Fetching details for ${epic}...`);
        const marketResponse = await fetch(`https://demo-api.ig.com/gateway/deal/markets/${epic}`, {
            headers: {
                'X-IG-API-KEY': IG_API_KEY,
                'CST': cst,
                'X-SECURITY-TOKEN': xSecurityToken,
                'Version': '3'
            }
        });
        
        const marketData = await marketResponse.json();
        
        // SIMULATE INDEX.JS LOGIC
        let dealSizeIncrement = marketData.dealingRules?.minDealSize?.value || 0.1;
        if (marketData.instrument?.type === 'SHARES' || epic.startsWith('UD.') || epic.startsWith('UA.') || epic.startsWith('UB.')) {
          dealSizeIncrement = 1.0; 
        }
        console.log(`dealSizeIncrement: ${dealSizeIncrement}`);
        
        const riskAmount = 100; // Example risk
        const entryPrice = marketData.snapshot.offer || 39.45;
        const marginPercent = 0.20; // 20%
        const exchangeRate = 0.95; // USD to EUR
        const contractSize = 1;
        
        const marginPerContract = entryPrice * marginPercent * exchangeRate * contractSize;
        let tradeSize = riskAmount / marginPerContract;
        
        console.log(`Raw tradeSize: ${tradeSize}`);
        
        // Rounding logic
        if (dealSizeIncrement >= 1) {
            tradeSize = Math.ceil(tradeSize / dealSizeIncrement) * dealSizeIncrement;
        } else {
            tradeSize = Math.ceil(tradeSize * 10) / 10;
        }
        
        tradeSize = Math.max(1, Math.min(tradeSize, 100));
        
        if (dealSizeIncrement >= 1) {
            tradeSize = Math.round(tradeSize);
        }
        
        console.log(`Final tradeSize: ${tradeSize}`);
        
        // 3. Try to Open Position
        console.log(`Attempting to open BUY position for ${epic} with size ${tradeSize}...`);
        
        const payload = {
            epic: epic,
            expiry: '-', // Explicitly set to '-'
            direction: 'BUY',
            size: tradeSize,
            orderType: 'MARKET',
            timeInForce: 'FILL_OR_KILL',
            guaranteedStop: false,
            forceOpen: true,
            currencyCode: 'USD'
        };
        
        console.log('Payload:', JSON.stringify(payload, null, 2));

        const tradeResponse = await fetch('https://demo-api.ig.com/gateway/deal/positions/otc', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'Accept': 'application/json; charset=UTF-8',
                'X-IG-API-KEY': IG_API_KEY,
                'CST': cst,
                'X-SECURITY-TOKEN': xSecurityToken,
                'Version': '2'
            },
            body: JSON.stringify(payload)
        });

        const tradeData = await tradeResponse.json();
        console.log('Trade Response:', JSON.stringify(tradeData, null, 2));
        
        if (tradeData.dealReference) {
            console.log(`Confirming deal ${tradeData.dealReference}...`);
            await new Promise(r => setTimeout(r, 2000));
            
            const confirmResponse = await fetch(`https://demo-api.ig.com/gateway/deal/confirms/${tradeData.dealReference}`, {
                headers: {
                    'X-IG-API-KEY': IG_API_KEY,
                    'CST': cst,
                    'X-SECURITY-TOKEN': xSecurityToken,
                    'Version': '1'
                }
            });
            
            const confirmData = await confirmResponse.json();
            console.log('Confirmation:', JSON.stringify(confirmData, null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

run();
