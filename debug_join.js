import { igApi } from './src/igApi.js';

async function run() {
    try {
        await igApi.login();
        
        console.log('Fetching recent transactions with FROM date...');
        const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const transResponse = await fetch(`${igApi.baseUrl}/history/transactions?from=${fromDate}&pageSize=20&type=ALL`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json; charset=UTF-8',
                'X-IG-API-KEY': igApi.apiKey,
                'CST': igApi.cst,
                'X-SECURITY-TOKEN': igApi.securityToken,
                'Version': '2'
            }
        });
        
        if (transResponse.ok) {
            const data = await transResponse.json();
            console.log(`Found ${data.transactions.length} transactions (Manual Fetch).`);
            if (data.transactions.length > 0) {
                console.log('Sample Transaction:', JSON.stringify(data.transactions[0], null, 2));
            }
        } else {
            console.log(`Transaction fetch failed: ${transResponse.status}`);
            console.log(await transResponse.text());
        }

        console.log('\nFetching recent activity...');
        const activityData = await igApi.getAccountActivity({ pageSize: 20 });
        const activities = activityData.activities;
        console.log(`Found ${activities.length} activities.`);
        if (activities.length > 0) {
            console.log('Sample Activity:');
            console.log(JSON.stringify(activities[0], null, 2));
        }

        // Try to find a match
        if (transactions.length > 0 && activities.length > 0) {
            const sampleTrans = transactions[0];
            console.log(`\nTrying to find match for Transaction Ref: ${sampleTrans.reference}`);
            
            const match = activities.find(a => a.dealId === sampleTrans.reference || (a.details && a.details.dealReference === sampleTrans.reference));
            if (match) {
                console.log('MATCH FOUND!');
                console.log('Activity:', match.dealId);
            } else {
                console.log('No direct match found in recent items.');
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

run();
