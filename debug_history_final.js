import { igApi } from './src/igApi.js';

async function run() {
    try {
        await igApi.login();
        
        const toDate = new Date().toISOString().split('T')[0];
        const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Last 30 days
        
        console.log(`Fetching account activity from ${fromDate} to ${toDate}...`);
        
        const activityData = await igApi.getAccountActivity({
            from: fromDate,
            to: toDate,
            detailed: true,
            pageSize: 200
        });
        
        let transactions = [];
        if (activityData && activityData.activities) {
            // Map activity to transaction format based on user request
            transactions = activityData.activities
                .filter(a => a.type === 'POSITION' && a.status === 'ACCEPTED')
                .map(a => {
                    const isClose = a.description.includes('geschlossen') || a.description.includes('Closed');
                    const isOpen = a.description.includes('eröffnet') || a.description.includes('Opened');
                    
                    return {
                        instrumentName: a.details.marketName, // "Instrument" -> MarketName
                        epic: a.epic,
                        size: a.details.size, // "Kontraktgröße" -> Size
                        direction: a.details.direction, // "Richtung"
                        openLevel: isOpen ? a.details.level : null, // "Start Price" (approximate)
                        level: a.details.level, // "Schlusskurs" -> Level
                        profitAndLoss: a.details.profitAndLoss || null, // "P&L" (might be missing in activity)
                        stop: a.details.stopLevel, // "SL" -> Stop
                        limit: a.details.limitLevel, // "TP"
                        dateUtc: a.date, // "Geschlossen am" -> Time
                        dealId: a.dealId, // "Deal ID"
                        transactionType: isOpen ? 'OPEN' : (isClose ? 'CLOSE' : 'UNKNOWN')
                    };
                });
        }
        
        const formatted = transactions.map(t => {
            // Parse profit string if present
            let profit = 0;
            if (t.profitAndLoss) {
                 // Try to parse if it's a string like "EUR 10.50"
                 if (typeof t.profitAndLoss === 'string') {
                     const match = t.profitAndLoss.match(/[-+]?[\d,.]+/);
                     if (match) profit = parseFloat(match[0].replace(',', '.'));
                 } else {
                     profit = t.profitAndLoss;
                 }
            }
            
            return {
                date: new Date(t.dateUtc).toLocaleString('de-DE'),
                symbol: t.instrumentName,
                direction: t.direction, // Use direction from activity
                size: t.size,
                openPrice: t.openLevel,
                closePrice: t.level,
                profit: profit ? `${profit.toFixed(2)}€` : '--',
                profitValue: profit,
                dealId: t.dealId,
                type: t.transactionType
            };
        });
        
        console.log(`Found ${formatted.length} formatted transactions.`);
        if (formatted.length > 0) {
            console.log('Sample Formatted Transaction:');
            console.log(JSON.stringify(formatted[0], null, 2));
        } else {
            console.log('Raw Activities Count:', activityData.activities ? activityData.activities.length : 0);
            if (activityData.activities && activityData.activities.length > 0) {
                console.log('Sample Raw Activity:');
                console.log(JSON.stringify(activityData.activities[0], null, 2));
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

run();
