
import { igApi } from './src/igApi.js';
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

// Load .env.live explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.live') });

// Force LIVE mode
process.env.IG_DEMO_MODE = 'false';

async function investigatePnL() {
  try {
    console.log('Logging in with .env.live credentials...');
    await igApi.login();

    console.log('Fetching open positions (List)...');
    const positions = await igApi.getOpenPositions();
    
    if (positions.length === 0) {
        console.log('No open positions found.');
        return;
    }

    for (const p of positions) {
        const dealId = p.position.dealId;
        console.log(`\n--- Investigating Position: ${p.market.instrumentName} (${dealId}) ---`);
        console.log(`List Response - Profit: ${p.position.profit}, Currency: ${p.position.currency}`);
        console.log(`List Response - Market Status: ${p.market.marketStatus}`);
        
        // Try fetching specific position details
        // Note: The endpoint might be /positions/{dealId}
        console.log(`\nFetching details for Deal ID: ${dealId}...`);
        
        const url = `${igApi.baseUrl}/positions/${dealId}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json; charset=UTF-8',
                'X-IG-API-KEY': igApi.apiKey,
                'CST': igApi.cst,
                'X-SECURITY-TOKEN': igApi.securityToken,
                'Version': '2' // Try version 2
            }
        });

        if (response.ok) {
            const detail = await response.json();
            console.log('Specific Position Details (V2):');
            console.log(JSON.stringify(detail, null, 2));
        } else {
            console.log(`Failed to fetch position details (V2): ${response.status}`);
            
            // Try Version 1
            console.log('Retrying with Version 1...');
            const responseV1 = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json; charset=UTF-8',
                    'X-IG-API-KEY': igApi.apiKey,
                    'CST': igApi.cst,
                    'X-SECURITY-TOKEN': igApi.securityToken,
                    'Version': '1'
                }
            });
            
            if (responseV1.ok) {
                const detailV1 = await responseV1.json();
                console.log('Specific Position Details (V1):');
                console.log(JSON.stringify(detailV1, null, 2));
            } else {
                console.log(`Failed to fetch position details (V1): ${responseV1.status}`);
            }
        }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

investigatePnL();
