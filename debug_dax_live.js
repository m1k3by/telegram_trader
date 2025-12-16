import 'dotenv/config';
import { igApi as IG_API } from './src/igApi.js';

async function debugDax() {
    try {
        await IG_API.login();
        console.log('Searching for "Germany 40"...');
        
        // Check the specific EPIC used in mapping
        const epic = 'IX.D.DAX.IFMM.IP';
        console.log(`Checking EPIC: ${epic}`);
        
        try {
            const details = await IG_API.getMarketDetails(epic);
            if (details) {
                console.log(`\nName: ${details.name}`);
                console.log(`EPIC: ${details.epic}`);
                console.log(`Min Deal Size: ${details.minDealSize}`);
                console.log(`Deal Size Increment: ${details.dealSizeIncrement}`);
                
                if (details.rawData && details.rawData.dealingRules) {
                    console.log('Raw Dealing Rules:', JSON.stringify(details.rawData.dealingRules, null, 2));
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

debugDax();