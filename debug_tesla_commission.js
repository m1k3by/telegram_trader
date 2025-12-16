import 'dotenv/config';
import { igApi as IG_API } from './src/igApi.js';

async function debugTesla() {
    try {
        await IG_API.login();
        console.log('Searching for "Tesla"...');
        
        const epic = 'UD.D.TSLA.CASH.IP'; // Tesla Cash CFD
        console.log(`Checking EPIC: ${epic}`);
        
        try {
            const details = await IG_API.getMarketDetails(epic);
            if (details) {
                console.log(`\nName: ${details.name}`);
                console.log(`EPIC: ${details.epic}`);
                console.log(`Type: ${details.type}`);
                
                if (details.rawData) {
                    console.log('Instrument Data:', JSON.stringify(details.rawData.instrument, null, 2));
                    console.log('Dealing Rules:', JSON.stringify(details.rawData.dealingRules, null, 2));
                    
                    // Check for any commission fields
                    const snapshot = details.rawData.snapshot;
                    console.log('Snapshot:', JSON.stringify(snapshot, null, 2));
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

debugTesla();