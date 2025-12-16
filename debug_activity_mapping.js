import { igApi } from './src/igApi.js';

async function run() {
    try {
        await igApi.login();
        
        // Calculate dates
        const toDate = new Date().toISOString().split('T')[0]; // Today YYYY-MM-DD
        const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 7 days ago
        
        console.log(`Fetching activity from ${fromDate} to ${toDate}...`);
        
        // We need to manually construct the URL because the current method doesn't support all params yet
        // So I will use the internal method logic here for debugging, or just modify the class first?
        // I'll modify the class first, it's safer.
        
        // Wait, I can't modify the class and run this script if I haven't modified the class yet.
        // I will use a direct fetch here to inspect the data structure.
        
        const response = await fetch(`${igApi.baseUrl}/history/activity?from=${fromDate}&to=${toDate}&detailed=true&pageSize=10`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json; charset=UTF-8',
                'X-IG-API-KEY': igApi.apiKey,
                'CST': igApi.cst,
                'X-SECURITY-TOKEN': igApi.securityToken,
                'Version': '3'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log(`Found ${data.activities.length} activities.`);
            if (data.activities.length > 0) {
                const closeActivity = data.activities.find(a => a.details && a.details.actions && a.details.actions.some(act => act.actionType === 'POSITION_CLOSED'));
                
                if (closeActivity) {
                    console.log('\nSample CLOSE Activity:');
                    console.log(JSON.stringify(closeActivity, null, 2));
                } else {
                    console.log('No POSITION_CLOSED activity found in the last 10 items.');
                }
            }
        } else {
            console.log(`Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.log(text);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

run();
