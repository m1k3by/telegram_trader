import 'dotenv/config';
import { igApi as IG_API } from './src/igApi.js';

async function debugGbpJpy() {
    try {
        await IG_API.login();
        console.log('Searching for "GBP/JPY Mini"...');
        
        const epic = 'CS.D.GBPJPY.MINI.IP';
        console.log(`Checking EPIC: ${epic}`);
        
        try {
            const details = await IG_API.getMarketDetails(epic);
            if (details) {
                console.log(`\nName: ${details.name}`);
                console.log(`EPIC: ${details.epic}`);
                console.log(`Min Deal Size: ${details.minDealSize}`);
                console.log(`Deal Size Increment: ${details.dealSizeIncrement}`);
                console.log(`Lot Size: ${details.rawData.instrument.lotSize}`);
                console.log(`Contract Size: ${details.rawData.instrument.contractSize}`);
                console.log(`Margin Factor: ${details.marginFactor}`);
                
                if (details.rawData && details.rawData.dealingRules) {
                    console.log('Raw Dealing Rules:', JSON.stringify(details.rawData.dealingRules, null, 2));
                }
                 if (details.rawData && details.rawData.instrument && details.rawData.instrument.currencies) {
                    console.log('Currencies:', JSON.stringify(details.rawData.instrument.currencies, null, 2));
                }
            } else {
                console.log('Market details not found.');
            }
        } catch (e) {
            console.log(`Error getting details: ${e.message}`);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugGbpJpy();