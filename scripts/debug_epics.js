
import { igApi } from '../src/igApi.js';

async function checkEpics() {
    console.log('Checking EPICs...');
    
    const epics = [
        'IX.D.SUNDAX.IGN.IP',  // Weekend DAX (Found)
        'IX.D.SUNDOW.IFE.IP',  // Weekend Wall Street (Found)
        'IX.D.SUNNAS.IFE.IP',  // Weekend Nasdaq (Found)
        'IX.D.SUNFUN.IFE.IP',  // Weekend FTSE (Found)
        'IX.D.SUNCAC.IMF.IP',  // Weekend CAC (Found)
        'IX.D.SUNSP.IFE.IP',   // Weekend S&P 500 (Guessed)
        'IX.D.SUNSP.IGN.IP'    // Another guess
    ];

    for (const epic of epics) {
        console.log(`\nChecking ${epic}...`);
        const details = await igApi.getMarketDetails(epic);
        if (details) {
            console.log(`✅ Valid: ${details.name} (${details.marketStatus})`);
        } else {
            console.log(`❌ Invalid EPIC: ${epic}`);
        }
    }
}

checkEpics();
