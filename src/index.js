import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import input from 'input';
import dotenv from 'dotenv';
import fs from 'fs';
import { parseLiveTrend, isValidTrend, formatTrend, trendStore, calculatePotential, mapInstrumentToIG } from './trendAnalyzer.js';
import { printHeader, createSummaryReport, selectBestPosition } from './helpers.js';
import { igApi } from './igApi.js';
import { startDashboard, broadcastSignal, broadcastTrade, broadcastStatus, updateServiceStatus, setIgApi, isTradingEnabled } from './dashboard.js';

// Load environment variables
dotenv.config();

// Configuration from environment variables
const API_ID = parseInt(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const PHONE_NUMBER = process.env.PHONE_NUMBER;
const SESSION_STRING = process.env.SESSION_STRING || '';
const TARGET_CHAT = process.env.TARGET_CHAT || '';

// Parse multiple target chats (comma-separated)
const TARGET_CHATS = TARGET_CHAT 
  ? TARGET_CHAT.split(',').map(chat => chat.trim()).filter(chat => chat)
  : [];

// Session management
const session = new StringSession(SESSION_STRING);

// Initialize Telegram client
const client = new TelegramClient(session, API_ID, API_HASH, {
  connectionRetries: 5,
});

/**
 * Process incoming messages
 * @param {Object} event - The message event object
 */
async function processMessage(event) {
  try {
    const message = event.message;
    
    // Skip if no message
    if (!message) return;
    
    let chat;
    let chatTitle;
    let chatId;
    
    // Try multiple ways to get chat info
    try {
      chat = await event.getChat();
      chatTitle = chat.title || chat.firstName || chat.username || 'Unknown';
      chatId = chat.id?.toString();
    } catch (error) {
      // Use peerId from message
      const peerId = message.peerId;
      if (peerId) {
        chatId = peerId.channelId?.toString() || peerId.chatId?.toString() || peerId.userId?.toString();
        
        // Try to get entity
        try {
          const entity = await client.getEntity(peerId);
          chatTitle = entity.title || entity.firstName || entity.username || 'Unknown';
        } catch (e) {
          chatTitle = `Chat_${chatId}`;
        }
      } else {
        return;
      }
    }
    
    // Extract message details
    const messageText = message.text || message.message || '';
    const senderId = message.senderId?.toString();
    const messageId = message.id;
    const timestamp = new Date(message.date * 1000).toISOString();
    
    // DEBUG: Log every incoming message
    console.log(`\n📨 INCOMING MESSAGE [${chatTitle}]: "${messageText.replace(/\n/g, ' ').substring(0, 1000)}..."`);

    // Filter 1: Check if it's from one of the target chats (if specified)
    if (TARGET_CHATS.length > 0 && !TARGET_CHATS.includes(chatTitle)) {
      return; // Ignore messages from other chats
    }
    
    // Filter 2: Check if message contains trading signals
    // LIVE TREND for open positions, or ICH SCHLIEßE for close, or SL update
    const hasLiveTrend = messageText.includes('LIVE TREND');
    const hasOpen = /ICH\s+(KAUFE|VERKAUFE)/i.test(messageText);
    const hasClose = /ICH\s+SCHLIE[ßS]E/i.test(messageText);
    const hasSL = /SL[:\s]|setze\s+den\s+SL/i.test(messageText); // Matches "SL: 2700" or "Ich setze den SL bei GOLD auf 3996"
    const hasTP = /TP[:\s]|setze\s+den\s+TP/i.test(messageText); // Matches "TP: 2800" or "Ich setze den TP bei GOLD auf 4100"
    
    if (!hasLiveTrend && !hasClose && !hasSL && !hasOpen && !hasTP) {
      console.log(`   ⏭️ SKIPPED: No trading signal detected`);
      return; // Ignore non-trading messages
    }
    
    // This is a trading signal - process it!
    const signalType = (hasLiveTrend || hasOpen) ? 'LIVE TREND' : hasClose ? 'POSITION CLOSE' : hasSL ? 'SL UPDATE' : 'TP UPDATE';
    console.log(`\n>>> ${signalType} DETECTED`);
    console.log('==========================================');
    console.log(`Chat: ${chatTitle} (ID: ${chatId})`);
    console.log(`Message ID: ${messageId}`);
    console.log(`Sender ID: ${senderId}`);
    console.log(`Time: ${timestamp}`);
    console.log(`\nMessage Content:\n${messageText}`);
    console.log('==========================================\n');
    
    // Process the LIVE TREND message
    await processTrendMessage(messageText, {
      chatTitle,
      chatId,
      messageId,
      senderId,
      timestamp
    });
    
  } catch (error) {
    console.error('Error processing message:', error);
  }
}

/**
 * Process a LIVE TREND message and extract trading information
 * @param {string} messageText - The message text
 * @param {Object} metadata - Message metadata
 */
async function processTrendMessage(messageText, metadata) {
  try {
    // Parse the message
    const trend = parseLiveTrend(messageText);
    
    console.log(`\nAnalyzing message... Type: ${trend.type}\n`);
    
    // Display parsed data
    const formatted = formatTrend(trend);
    if (formatted) {
      console.log(formatted);
      console.log('');
    }
    
    // Store the trend
    trendStore.add(trend);
    
    // Handle different message types
    if (trend.type === 'POSITION_OPEN') {
      console.log('📈 NEW POSITION SIGNAL!\n');
      
      // Check if trading is enabled
      if (!isTradingEnabled()) {
        console.log('⚠️  TRADING DISABLED - Signal logged but not executed\n');
        
        broadcastTrade({
          symbol: trend.data.instrument,
          direction: trend.data.direction,
          entryPrice: trend.data.entryPrice,
          status: 'info',
          message: 'Trading disabled - signal logged only',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Execute trade if enabled
      if (trend.data.instrument && trend.data.direction) {
        console.log('Executing trade via IG Markets API...\n');
        
        // Get IG EPIC code for instrument
        const igMapping = mapInstrumentToIG(trend.data.instrument);
        
        if (!igMapping.epic) {
          console.log(`❌ No IG EPIC found for ${trend.data.instrument}\n`);
          
          // Broadcast error as single event
          broadcastTrade({
            symbol: trend.data.instrument,
            direction: trend.data.direction,
            entryPrice: trend.data.entryPrice,
            status: 'error',
            message: `No IG EPIC found for ${trend.data.instrument}`,
            timestamp: new Date().toISOString()
          });
          return;
        }
        
        console.log(`IG EPIC: ${igMapping.epic}`);
        console.log(`Symbol: ${igMapping.symbol}\n`);
        
        try {
          let tradeResult = await igApi.executeTrade({
            epic: igMapping.epic,
            symbol: igMapping.symbol,
            expiry: igMapping.expiry,
            direction: trend.data.direction,
            entryPrice: trend.data.entryPrice,
            stopLevel: trend.data.stopLoss,
            takeProfit: trend.data.takeProfit,
            optionType: trend.data.optionType,
            strikePrice: trend.data.strikePrice,
            isOption: trend.data.isOption
          });

          // FALLBACK LOGIC: If primary trade fails and fallback exists
          if (tradeResult.status === 'error' && igMapping.fallback) {
            console.log(`\n⚠️ Primary trade for ${igMapping.symbol} failed.`);
            console.log(`🔄 Attempting fallback to ${igMapping.fallback.symbol}...\n`);
            
            const fallbackResult = await igApi.executeTrade({
              epic: igMapping.fallback.epic,
              symbol: igMapping.fallback.symbol,
              expiry: igMapping.fallback.expiry,
              direction: trend.data.direction,
              entryPrice: trend.data.entryPrice, // Note: Price might differ significantly!
              stopLevel: trend.data.stopLoss,    // Note: SL might be invalid for fallback!
              takeProfit: trend.data.takeProfit,
              optionType: trend.data.optionType,
              strikePrice: trend.data.strikePrice,
              isOption: trend.data.isOption
            });

            // Use fallback result but mark it
            tradeResult = fallbackResult;
            tradeResult.isFallback = true;
            tradeResult.originalSymbol = igMapping.symbol;
            tradeResult.fallbackSymbol = igMapping.fallback.symbol;
            
            if (tradeResult.status === 'success') {
              tradeResult.message = `⚠️ FALLBACK EXECUTED: ${igMapping.fallback.symbol} (Primary ${igMapping.symbol} failed)`;
            }
          }
          
          // Broadcast SINGLE combined event with all info
          broadcastTrade({
            epic: tradeResult.isFallback ? igMapping.fallback.epic : igMapping.epic,
            symbol: tradeResult.isFallback ? igMapping.fallback.symbol : igMapping.symbol,
            direction: trend.data.direction,
            entryPrice: trend.data.entryPrice,
            optionType: trend.data.optionType,
            strikePrice: trend.data.strikePrice,
            status: tradeResult.status,
            dealReference: tradeResult.dealReference,
            dealId: tradeResult.dealId,
            dealStatus: tradeResult.dealStatus,
            size: tradeResult.size,
            level: tradeResult.level,
            currency: tradeResult.currency,
            riskAmount: parseFloat(process.env.FIXED_RISK_AMOUNT || 50),
            reason: tradeResult.reason,
            message: tradeResult.message || tradeResult.error,
            chat: metadata.chatTitle,
            timestamp: new Date().toISOString(),
            isFallback: tradeResult.isFallback,
            originalSymbol: tradeResult.originalSymbol
          });
          
          if (tradeResult.status === 'success') {
            console.log('✅ TRADE EXECUTED SUCCESSFULLY!');
            if (tradeResult.isFallback) {
              console.log(`⚠️ NOTE: This was a FALLBACK trade on ${tradeResult.fallbackSymbol}`);
            }
            console.log(`Deal Reference: ${tradeResult.dealReference}`);
            console.log(`Deal ID: ${tradeResult.dealId}`);
            console.log(`Size: ${tradeResult.size}`);
            console.log(`Level: ${tradeResult.level}\n`);
          } else if (tradeResult.status === 'logged') {
            console.log('📝 Trade logged (trading disabled)\n');
          } else {
            console.log(`❌ Trade failed: ${tradeResult.message || tradeResult.error}\n`);
          }
        } catch (error) {
          console.error('Error executing trade:', error.message || error);
          
          broadcastTrade({
            epic: igMapping?.epic,
            symbol: igMapping?.symbol || trend.data.instrument,
            direction: trend.data.direction,
            entryPrice: trend.data.entryPrice,
            status: 'error',
            message: error.message || error,
            timestamp: new Date().toISOString()
          });
        }
      }
      
    } else if (trend.type === 'POSITION_CLOSE') {
      console.log('🔒 POSITION CLOSE SIGNAL!\n');
      console.log(`Instrument: ${trend.data.instrument}`);
      console.log(`Result: ${trend.data.result}`);
      console.log(`Profit/Loss: ${trend.data.profit > 0 ? '+' : ''}${trend.data.profit}€\n`);
      
      // Send win.gif to Telegram if profit is positive
      if (trend.data.profit > 0) {
        try {
          console.log('🎉 Profit detected! Sending win.gif to Telegram...');
          await client.sendMessage(metadata.chatId, {
            message: `🎉🎉🎉 GEWINN! +${trend.data.profit}€ mit ${trend.data.instrument}! 🎉🎉🎉`,
            file: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif' // Fun "You Win!" GIF
          });
          console.log('✅ win.gif sent to Telegram!');
        } catch (error) {
          console.error('⚠️ Failed to send win.gif:', error.message);
        }
      }
      
      // Get IG EPIC for instrument
      const igMapping = mapInstrumentToIG(trend.data.instrument);
      
      if (igMapping.epic) {
        try {
          // Get open positions and close matching one
          const positions = await igApi.getOpenPositions();
          console.log(`Found ${positions.length} open position(s)\n`);
          
          // Debug: Show position details
          if (positions.length > 0) {
            console.log('All positions:');
            positions.forEach((p, i) => {
              console.log(`  ${i+1}. ${p.market.epic} - Deal: ${p.position.dealId}, Direction: ${p.position.direction}, Size: ${p.position.size}`);
            });
            console.log('\nFirst position full structure:');
            console.log(JSON.stringify(positions[0], null, 2));
            console.log('');
          }
          
          // Find all matching positions for this instrument
          let matchingPositions = positions.filter(p => p.market.epic === igMapping.epic);
          
          // FALLBACK CHECK: If no primary position found, check fallback
          if (matchingPositions.length === 0 && igMapping.fallback) {
            console.log(`⚠️ No primary position found for ${igMapping.symbol}. Checking fallback: ${igMapping.fallback.symbol}...`);
            matchingPositions = positions.filter(p => p.market.epic === igMapping.fallback.epic);
            if (matchingPositions.length > 0) {
              console.log(`✅ Found fallback position(s) for ${igMapping.fallback.symbol}!`);
            }
          }

          console.log(`Found ${matchingPositions.length} position(s) to close\n`);
          
          if (matchingPositions.length > 0) {
            // If multiple positions exist, intelligently select the best one to close
            let positionToClose;
            
            if (matchingPositions.length > 1) {
              console.log(`⚠️  Multiple positions found - selecting the one with highest profit...`);
              positionToClose = selectBestPosition(matchingPositions, trend.data.instrument, { action: 'close' });
            } else {
              positionToClose = matchingPositions[0];
            }
            
            if (positionToClose) {
              console.log(`Closing position: ${positionToClose.position.dealId}`);
              
              const closeResult = await igApi.closePosition(
                positionToClose.position.dealId,
                positionToClose.market.epic, // Use actual EPIC from position
                positionToClose.position.direction,
                positionToClose.position.size
              );
              
              // Extract profit/loss from confirmation
              const profitLoss = closeResult.confirmation?.profit || 0;
              
              broadcastTrade({
                epic: positionToClose.market.epic,
                symbol: igMapping.symbol,
                direction: 'CLOSE',
                status: closeResult.status,
                dealReference: closeResult.dealReference,
                dealId: closeResult.dealId,
                message: closeResult.message,
                profit: profitLoss,
                timestamp: new Date().toISOString()
              });
              
              console.log(closeResult.status === 'success' ? '✅ Position closed!' : '❌ Close failed');
            }
            
            console.log(`\n✅ Position closed!`);
          } else {
            console.log('⚠️  No open position found for this instrument\n');
            // Broadcast error as requested
            broadcastTrade({
              symbol: trend.data.instrument,
              direction: 'CLOSE',
              status: 'error',
              message: `No open position found for ${trend.data.instrument} (or fallback)`,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error closing position:', error.message);
        }
      } else {
        console.log('📝 Position close logged (no IG EPIC found)\n');
      }
      
    } else if (trend.type === 'STOP_LOSS_UPDATE') {
      console.log('🛑 STOP LOSS UPDATE!\n');
      console.log(`Instrument: ${trend.data.instrument}`);
      console.log(`New SL: ${trend.data.stopLoss}\n`);
      
      // Get IG EPIC for instrument
      const igMapping = mapInstrumentToIG(trend.data.instrument);
      
      if (igMapping.epic) {
        try {
          // Get open positions and update matching one
          const positions = await igApi.getOpenPositions();
          let matchingPositions = positions.filter(p => p.market.epic === igMapping.epic);
          
          // FALLBACK CHECK: If no primary position found, check fallback
          if (matchingPositions.length === 0 && igMapping.fallback) {
             console.log(`⚠️ No primary position found for ${igMapping.symbol}. Checking fallback: ${igMapping.fallback.symbol}...`);
             matchingPositions = positions.filter(p => p.market.epic === igMapping.fallback.epic);
             if (matchingPositions.length > 0) {
               console.log(`✅ Found fallback position(s) for ${igMapping.fallback.symbol}!`);
               console.log(`⚠️ WARNING: Applying SL ${trend.data.stopLoss} to fallback instrument. Ensure price levels match!`);
             }
          }
          
          // Select best position if multiple exist
          let matchingPosition = null;
          if (matchingPositions.length > 0) {
            if (matchingPositions.length > 1) {
              console.log(`⚠️  Multiple positions found - selecting the one with highest loss...`);
              matchingPosition = selectBestPosition(matchingPositions, trend.data.instrument, {
                stopLoss: trend.data.stopLoss
              });
            } else {
              matchingPosition = matchingPositions[0];
            }
          }
          
          if (matchingPosition) {
            console.log(`Updating SL for: ${matchingPosition.position.dealId}\n`);
            
            const updateResult = await igApi.updateStopLoss(
              matchingPosition.position.dealId,
              trend.data.stopLoss
            );
            
            // Log detailed error if validation failed
            if (updateResult.status === 'error' && updateResult.validation) {
              console.error(`\n⚠️  SL VALIDATION FAILED:`);
              console.error(`   Position: ${updateResult.validation.direction} @ ${updateResult.validation.currentPrice}`);
              console.error(`   Requested SL: ${updateResult.validation.requestedSL}`);
              console.error(`   Reason: ${updateResult.validation.reason}\n`);
            }
            
            broadcastTrade({
              epic: matchingPosition.market.epic,
              symbol: igMapping.symbol,
              direction: 'SL_UPDATE',
              status: updateResult.status,
              stopLoss: trend.data.stopLoss,
              dealId: matchingPosition.position.dealId,
              dealReference: updateResult.dealReference,
              message: updateResult.message,
              validation: updateResult.validation,
              timestamp: new Date().toISOString()
            });
            
            console.log(updateResult.status === 'success' ? '✅ SL updated!' : `❌ Update failed: ${updateResult.message}`);
          } else {
            console.log('⚠️  No open position found for this instrument\n');
            // Broadcast error as requested
            broadcastTrade({
              symbol: trend.data.instrument,
              direction: 'SL_UPDATE',
              status: 'error',
              message: `No open position found for ${trend.data.instrument} (or fallback)`,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error updating SL:', error.message);
        }
      } else {
        console.log('📝 SL update logged (no IG EPIC found)\n');
      }
      
    } else if (trend.type === 'TAKE_PROFIT_UPDATE') {
      console.log('🎯 TAKE PROFIT UPDATE!\n');
      console.log(`Instrument: ${trend.data.instrument}`);
      console.log(`New TP: ${trend.data.takeProfit}\n`);
      
      // Get IG EPIC for instrument
      const igMapping = mapInstrumentToIG(trend.data.instrument);
      
      if (igMapping.epic) {
        try {
          // Get open positions and update matching one
          const positions = await igApi.getOpenPositions();
          let matchingPositions = positions.filter(p => p.market.epic === igMapping.epic);
          
          // FALLBACK CHECK: If no primary position found, check fallback
          if (matchingPositions.length === 0 && igMapping.fallback) {
             console.log(`⚠️ No primary position found for ${igMapping.symbol}. Checking fallback: ${igMapping.fallback.symbol}...`);
             matchingPositions = positions.filter(p => p.market.epic === igMapping.fallback.epic);
             if (matchingPositions.length > 0) {
               console.log(`✅ Found fallback position(s) for ${igMapping.fallback.symbol}!`);
               console.log(`⚠️ WARNING: Applying TP ${trend.data.takeProfit} to fallback instrument. Ensure price levels match!`);
             }
          }
          
          // Select best position if multiple exist
          let matchingPosition = null;
          if (matchingPositions.length > 0) {
            if (matchingPositions.length > 1) {
              console.log(`⚠️  Multiple positions found - selecting the one with highest loss...`);
              matchingPosition = selectBestPosition(matchingPositions, trend.data.instrument, { takeProfit: trend.data.takeProfit });
            } else {
              matchingPosition = matchingPositions[0];
            }
          }
          
          if (matchingPosition) {
            console.log(`Updating TP for: ${matchingPosition.position.dealId}\n`);
            
            const tpResult = await igApi.updateTakeProfit(
              matchingPosition.position.dealId,
              trend.data.takeProfit
            );
            
            if (tpResult.success) {
              console.log('✅ TP updated!');
              broadcastTrade({
                epic: matchingPosition.market.epic,
                symbol: igMapping.symbol,
                direction: 'TP_UPDATE',
                status: 'success',
                takeProfit: trend.data.takeProfit,
                dealId: matchingPosition.position.dealId,
                message: `TP updated to ${trend.data.takeProfit}`,
                timestamp: new Date().toISOString()
              });
            } else {
              console.log('❌ TP update failed:', tpResult.error);
              broadcastTrade({
                epic: matchingPosition.market.epic,
                symbol: igMapping.symbol,
                direction: 'TP_UPDATE',
                status: 'error',
                message: tpResult.error || 'Failed to update TP',
                timestamp: new Date().toISOString()
              });
            }
          } else {
            console.log('⚠️  No open position found for this instrument\n');
            // Broadcast error as requested
            broadcastTrade({
              symbol: trend.data.instrument,
              direction: 'TP_UPDATE',
              status: 'error',
              message: `No open position found for ${trend.data.instrument} (or fallback)`,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error updating TP:', error.message);
        }
      } else {
        console.log('📝 TP update logged (no IG EPIC found)\n');
      }
      
    } else {
      // Generic LIVE TREND or unknown type
      console.log('ℹ️  Generic LIVE TREND message\n');
    }
    
    console.log('Trend stored in memory');
    const stats = trendStore.getStats();
    console.log(`Total trends stored: ${stats.total}\n`);
    console.log('==========================================\n');
    
  } catch (error) {
    console.error('ERROR processing message:', error);
  }
}

/**
 * Main function to start the Telegram client
 */
async function main() {
  printHeader();
  console.log('Starting Telegram Message Reader...\n');
  
  try {
    // Start the dashboard server
    console.log('Starting web dashboard...\n');
    startDashboard();
    console.log('Dashboard running at http://localhost:3000\n');
    
    // Set IG API reference for dashboard
    setIgApi(igApi);
    
    // Login to IG Markets
    try {
      await igApi.login();
      updateServiceStatus('igMarkets', true);
    } catch (error) {
      console.error('IG Markets login failed:', error.message);
      updateServiceStatus('igMarkets', false);
    }
    
    // Start the client
    await client.start({
      phoneNumber: async () => PHONE_NUMBER,
      password: async () => await input.text('Please enter your 2FA password (if enabled): '),
      phoneCode: async () => await input.text('Please enter the code you received: '),
      onError: (err) => console.error('Authentication error:', err),
    });
    
    console.log('Successfully connected to Telegram!\n');
    updateServiceStatus('telegram', true);
    
    // Broadcast connection status
    broadcastStatus({
      connected: true,
      user: null, // Will be updated below
      chats: TARGET_CHATS,
      timestamp: new Date().toISOString()
    });
    
    // Save session string for future use (no need to re-authenticate)
    const sessionString = client.session.save();
    console.log('Save this session string to your .env file as SESSION_STRING:');
    console.log(sessionString);

    // Auto-save to .env
    try {
      const envPath = '.env';
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        // Check if SESSION_STRING exists
        if (envContent.includes('SESSION_STRING=')) {
          // Replace existing line
          envContent = envContent.replace(/^SESSION_STRING=.*$/m, `SESSION_STRING=${sessionString}`);
        } else {
          // Append new line
          envContent += `\nSESSION_STRING=${sessionString}\n`;
        }
        fs.writeFileSync(envPath, envContent);
        console.log('\n✅ Session string automatically saved to .env file!');
      }
    } catch (error) {
      console.error('⚠️ Could not auto-save session to .env:', error.message);
    }
    
    console.log('\n');
    
    // Get information about the current user
    const me = await client.getMe();
    console.log(`Logged in as: ${me.firstName} ${me.lastName || ''} (@${me.username || 'no username'})\n`);
    
    // Update status with user info
    broadcastStatus({
      connected: true,
      user: `${me.firstName} ${me.lastName || ''} (@${me.username || 'no username'})`,
      chats: TARGET_CHATS,
      timestamp: new Date().toISOString()
    });
    
    // Add new message event handler - listen to ALL new messages
    client.addEventHandler(processMessage, new NewMessage({}));
    
    console.log('Listening for messages...');
    if (TARGET_CHATS.length > 0) {
      console.log(`Monitoring ${TARGET_CHATS.length} chat(s):`);
      TARGET_CHATS.forEach(chat => console.log(`   - ${chat}`));
    } else {
      console.log('Monitoring all chats');
    }
    console.log('\n==========================================\n');
    
    // Heartbeat to keep services alive (every 5 minutes)
    setInterval(() => {
      // Update Telegram status
      updateServiceStatus('telegram', client.connected);
      
      // Check IG Markets connection
      if (igApi.isLoggedIn()) {
        updateServiceStatus('igMarkets', true);
      } else {
        // Try to re-login if disconnected
        igApi.login()
          .then(() => updateServiceStatus('igMarkets', true))
          .catch(() => updateServiceStatus('igMarkets', false));
      }
    }, 5 * 60 * 1000);
    
    // Keep the process running
    console.log('Press Ctrl+C to stop\n');
    
  } catch (error) {
    console.error('ERROR starting client:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down gracefully...');
  
  // Show summary before exit
  const allTrends = trendStore.getAll();
  if (allTrends.length > 0) {
    console.log('\n');
    console.log(createSummaryReport(allTrends));
  }
  
  await client.disconnect();
  console.log('\nDisconnected from Telegram');
  process.exit(0);
});

// Start the application
main().catch(console.error);
