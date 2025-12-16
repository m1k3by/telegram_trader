
import { processTrendMessage } from './src/index.js';
import { igApi } from './src/igApi.js';
import dotenv from 'dotenv';

dotenv.config();

// 🕵️ MONKEY-PATCH IG API TO CAPTURE RESULTS FOR SIMULATION
let lastOperationResult = null;

// Helper to wrap API methods
function wrapApiMethod(methodName) {
  const originalMethod = igApi[methodName].bind(igApi);
  igApi[methodName] = async (...args) => {
    // console.log(`🕵️ Simulation capturing ${methodName}...`);
    try {
      const result = await originalMethod(...args);
      lastOperationResult = result;
      return result;
    } catch (error) {
      lastOperationResult = { status: 'error', message: error.message };
      throw error;
    }
  };
}

// Wrap relevant methods
wrapApiMethod('executeTrade');
wrapApiMethod('closePosition');
wrapApiMethod('updateStopLoss');
wrapApiMethod('createPosition'); // Used in retry logic

const messages = [
  `> Trading Coach:
🚦LIVE TREND🚦
ICH KAUFE GOLD (EK: 4122.39) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🖼 ICH SCHLIEßE GOLD❗861€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH VERKAUFE BRENT (EK: 63.92) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🖼 ICH SCHLIEßE BRENT❗3.598€ GEWINN 🎉🤑📈📉 HAMMER ✅Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH KAUFE BRENT (EK: 63.44) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
Ich setze den SL bei BRENT auf 62.92`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH KAUFE BRENT (EK: 62.77) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
Ich setze den SL bei BRENT auf 62.26`,

  `> Trading Coach:
🖼 ICH SCHLIEßE BRENT❗1.588€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
🖼 Das war der Trade des Tages 💎Glückwunsch an alle die gestern dabei waren ✅ Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH VERKAUFE BRENT (EK: 62.97) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🖼 ICH SCHLIEßE BRENT❗794€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH KAUFE BITCOIN (EK: 99247.68) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🖼 ICH SCHLIEßE BITCOIN❗462€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
📊 Photo

🚦LIVE TREND🚦
ICH VERKAUFE DAX (EK: 23935.9) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🖼 ICH SCHLIEßE DAX❗797€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH KAUFE BITCOIN PUT 95000 (EK: 2922.00) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH VERKAUFE GBP/JPY (EK: 205.344) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
Ich setze den SL bei GBP/JPY auf 206.159`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH VERKAUFE GBP/JPY (EK: 206.138) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🖼 ICH SCHLIEßE GBP/JPY❗900€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH VERKAUFE GBP/JPY (EK: 205.870) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH VERKAUFE BRENT (EK: 62.90) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🖼 ICH SCHLIEßE GBP/JPY❗1.353€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
🖼 ICH SCHLIEßE BRENT❗1.589€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH KAUFE NVIDIA (EK: 180.96) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
Liebe Trader 📈Wenn ihr an weiteren ebooks interessiert seid und die Analysemethoden kennenlernen wollt gebt mir einfach kurz Bescheid @floriansteiner`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH VERKAUFE TESLA (EK: 438.02) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH KAUFE EUR/USD (EK: 1.16724) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
Ich setze den SL bei TESLA auf 478.14`,

  `> Trading Coach:
Ich setze den SL bei EUR/USD auf 1.16289`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH KAUFE GBP/JPY (EK: 207.202) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
Ich setze den SL bei GBP/JPY auf 206.380`,

  `> Trading Coach:
Liebe Trader ℹ️ Falls ihr noch Hilfe bei der Erhöhung des Multiplikators braucht gebt mir einfach kurz Bescheid 📈 @floriansteiner`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH VERKAUFE NASDAQ (EK: 25661.42) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🖼 ICH SCHLIEßE NASDAQ❗649€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH KAUFE GBP/JPY (EK: 206.583) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🖼 ICH SCHLIEßE GBP/JPY❗927€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH KAUFE GBP/JPY (EK: 206.889) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH KAUFE BOEING (EK: 199.62) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🖼 ICH SCHLIEßE NVIDIA❗696€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
Ich setze den SL bei GBP/JPY auf 206.059`,

  `> Trading Coach:
🖼 ICH SCHLIEßE BOEING❗483€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH VERKAUFE BOEING (EK: 201.63) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
Ich setze den SL bei BOEING auf 219.56`,

  `> Trading Coach:
🚦LIVE TREND🚦
ICH VERKAUFE USD/CAD (EK: 1.39561) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`,

  `> Trading Coach:
🖼 ICH SCHLIEßE USD/CAD❗419€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`,

  `> Trading Coach:
🖼 ICH SCHLIEßE GBP/JPY❗787€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`

  `> Trading Coach:
🚦LIVE TREND🚦
ICH KAUFE GITLAB (EK: 39.16) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`

  `> Trading Coach:
ICH SCHLIEßE GITLAB❗497€ GEWINN 🎉🤑📈📉 Glückwunsch an alle die dabei waren 👍 Hier kannst du mittraden: cutt.ly/tradecfd`

`> Trading Coach:
🚦LIVE TREND🚦
ICH KAUFE SILBER (EK: 57.967) 
Hier traden:  https://cutt.ly/tradecfd
Ich wähle den maximalen Multiplikator ℹ️`

];

async function runSimulation() {
  console.log('🚀 STARTING LIVE TEST SIMULATION');
  console.log('================================');
  
  try {
    // Login to IG
    console.log('🔑 Logging in to IG Markets...');
    await igApi.login();
    console.log('✅ Logged in successfully');
    
    const summary = [];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      console.log(`\n\n==================================================`);
      console.log(`📨 PROCESSING MESSAGE ${i + 1}/${messages.length}`);
      console.log(`==================================================`);
      console.log(msg.trim());
      
      // Reset capture
      lastOperationResult = null;
      
      // Get pre-state
      let preAccount = { balance: 0, deposit: 0 };
      let prePositions = [];
      try {
        preAccount = await igApi.getAccountInfo();
        prePositions = await igApi.getOpenPositions();
      } catch (e) { console.log('⚠️ Could not fetch pre-state'); }
      
      console.log(`\n📊 PRE-STATE:`);
      console.log(`   Balance: ${preAccount.balance} EUR`);
      console.log(`   Used Margin: ${preAccount.deposit} EUR`);
      console.log(`   Open Positions: ${prePositions.length}`);
      
      // Process message
      const startTime = Date.now();
      await processTrendMessage(msg, {
        chatTitle: 'SIMULATION',
        chatId: 123456,
        messageId: i,
        senderId: 999,
        timestamp: Math.floor(Date.now() / 1000)
      });
      
      // Wait a bit for API to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get post-state
      let postAccount = { balance: 0, deposit: 0 };
      let postPositions = [];
      try {
        postAccount = await igApi.getAccountInfo();
        postPositions = await igApi.getOpenPositions();
      } catch (e) { console.log('⚠️ Could not fetch post-state'); }
      
      console.log(`\n📊 POST-STATE:`);
      console.log(`   Balance: ${postAccount.balance} EUR`);
      console.log(`   Used Margin: ${postAccount.deposit} EUR`);
      console.log(`   Open Positions: ${postPositions.length}`);
      
      // Calculate changes
      const marginChange = postAccount.deposit - preAccount.deposit;
      const positionsChange = postPositions.length - prePositions.length;
      
      // Determine status from captured result
      let status = 'NO_ACTION';
      let reason = '-';
      
      if (lastOperationResult) {
        if (lastOperationResult.status === 'success') {
          status = '✅ SUCCESS';
          reason = lastOperationResult.message || 'OK';
        } else {
          status = '❌ FAILED';
          reason = lastOperationResult.message || lastOperationResult.reason || 'Unknown Error';
        }
      } else {
        // If no API call was made, check if it was a message that SHOULD have triggered one
        if (msg.includes('KAUFE') || msg.includes('VERKAUFE') || msg.includes('SCHLIEßE') || msg.includes('SL')) {
             status = '⚠️ SKIPPED';
             reason = 'No API call triggered (Duplicate? Parsed wrong?)';
        } else {
             status = 'ℹ️ INFO';
             reason = 'Chat message / No Action';
        }
      }

      summary.push({
        id: i + 1,
        action: msg.includes('KAUFE') ? 'BUY' : msg.includes('VERKAUFE') ? 'SELL' : msg.includes('SCHLIEßE') ? 'CLOSE' : msg.includes('SL') ? 'SL_UPDATE' : 'OTHER',
        status: status,
        reason: reason.substring(0, 50), // Truncate for table
        marginChange: isNaN(marginChange) ? '-' : (marginChange > 0 ? `+${marginChange.toFixed(2)}` : marginChange.toFixed(2)),
        posChange: positionsChange > 0 ? `+${positionsChange}` : positionsChange
      });
      
      console.log(`\n📝 RESULT: ${status}`);
      console.log(`   Reason: ${reason}`);
      console.log(`   Margin Change: ${isNaN(marginChange) ? '-' : (marginChange > 0 ? '+' : '') + marginChange.toFixed(2)} EUR`);
      console.log(`   Positions Change: ${positionsChange > 0 ? '+' : ''}${positionsChange}`);
      
      // Wait 5 seconds before next message to avoid rate limits
      console.log(`\n⏳ Waiting 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('\n\n================================');
    console.log('🏁 SIMULATION COMPLETE');
    console.log('================================');
    console.table(summary);
    
  } catch (error) {
    console.error('❌ SIMULATION FAILED:', error);
  }
}

runSimulation();
