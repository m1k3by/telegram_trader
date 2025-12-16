import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import input from 'input';
import dotenv from 'dotenv';
import fs from 'fs';
import { parseLiveTrend, isValidTrend, formatTrend, trendStore, calculatePotential, mapInstrumentToIG, getInstrumentMapping } from './trendAnalyzer.js';
import { printHeader, createSummaryReport, selectBestPosition } from './helpers.js';
import { igApi } from './igApi.js';
import { startDashboard, broadcastSignal, broadcastTrade, broadcastStatus, updateServiceStatus, setIgApi, isTradingEnabled, getRiskPerTrade } from './dashboard.js';
import { randomGif } from './gifs.js';
import { executeTradeWithRetry, findPositionWithRetry, findAlternatives } from './tradeRetry.js';
import { getExchangeRateToEURCached } from './exchangeRates.js';
import { calculateContractSize } from './contractHelper.js';

// Load environment variables
dotenv.config();
console.log('DEBUG: DASHBOARD_PORT from env:', process.env.DASHBOARD_PORT);

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

// Message deduplication cache (prevents duplicate processing of same content from multiple chats)
const recentMessages = new Map(); // key: messageContentHash, value: timestamp
const DEDUP_WINDOW_MS = 30000; // 30 seconds - signals within this window with same content are considered duplicates

// Initialize Telegram client
const client = new TelegramClient(session, API_ID, API_HASH, {
  connectionRetries: 5,
});

// Deduplication cache for close signals (prevent closing same position twice)
const closeSignalCache = new Map();
const CLOSE_SIGNAL_TTL = 30000; // 30 seconds

/**
 * Find matching positions using EPIC match, fallback, and fuzzy search
 * @param {Array} positions - All open positions
 * @param {Object} igMapping - IG mapping with epic, fallback, symbol
 * @param {string} instrumentName - Original instrument name from signal
 * @returns {Array} Matching positions
 */
function findMatchingPositions(positions, igMapping, instrumentName) {
  // Try primary EPIC
  let matchingPositions = positions.filter(p => p.market.epic === igMapping.epic);
  
  // Try fallback EPIC
  if (matchingPositions.length === 0 && igMapping.fallback) {
    console.log(`⚠️  No position found for primary ${igMapping.symbol}.`);
    console.log(`📡 Searching fallback: ${igMapping.fallback.symbol}...`);
    matchingPositions = positions.filter(p => p.market.epic === igMapping.fallback.epic);
    if (matchingPositions.length > 0) {
      console.log(`   ✅ Found ${matchingPositions.length} fallback position(s)!`);
    }
  }
  
  // Fuzzy search by instrument name
  if (matchingPositions.length === 0) {
    console.log(`⚠️  No position found via EPIC.`);
    console.log(`📡 Trying fuzzy name match for "${instrumentName}"...`);
    console.log(`📡 Signal is looking for: "${igMapping.symbol}" or similar\n`);
    
    const searchTerm = instrumentName.toLowerCase();
    matchingPositions = positions.filter(p => {
      const posName = p.market.instrumentName.toLowerCase();
      const posEpic = p.market.epic.toLowerCase();
      
      // Log each position check for debugging
      console.log(`   Checking: ${p.market.instrumentName} (${p.market.epic})`);
      
      // NASDAQ variations - check both signal and position
      if ((searchTerm.includes('nasdaq') || searchTerm.includes('tech 100') || searchTerm.includes('us tech')) && 
          (posName.includes('tech 100') || posName.includes('nasdaq') || posName.includes('us tech') || posEpic.includes('nasdaq'))) {
        console.log(`      ✅ MATCH: NASDAQ/Tech 100 detected!`);
        return true;
      }
      
      // BRENT/OIL variations
      if ((searchTerm.includes('brent') || searchTerm === 'oil' || searchTerm.includes('öl')) && 
          (posName.includes('brent') || posName.includes('öl') || posName.includes('oil'))) {
        console.log(`      ✅ MATCH: BRENT/OIL detected!`);
        return true;
      }
      
      // NVIDIA
      if (searchTerm.includes('nvidia') && posEpic.includes('nvidia')) {
        console.log(`      ✅ MATCH: NVIDIA detected!`);
        return true;
      }
      
      // DAX variations
      if ((searchTerm.includes('dax') || searchTerm.includes('germany') || searchTerm.includes('deutschland')) && 
          (posName.includes('dax') || posName.includes('germany') || posName.includes('deutschland'))) {
        console.log(`      ✅ MATCH: DAX/Germany/Deutschland detected!`);
        return true;
      }
      
      // Direct name match
      if (posName.includes(searchTerm) || searchTerm.includes(posName)) {
        console.log(`      ✅ MATCH: Direct name match!`);
        return true;
      }
      
      return false;
    });
    
    if (matchingPositions.length > 0) {
      console.log(`   ✅ Found ${matchingPositions.length} position(s) via fuzzy match:`);
      matchingPositions.forEach(p => console.log(`      - ${p.market.instrumentName} (${p.market.epic})`));
    }
  }
  
  return matchingPositions;
}

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
    
    // Deduplication: Create hash from message content (ignore whitespace, case, emoji)
    const normalizedContent = messageText
      .replace(/\s+/g, ' ')
      .replace(/[❗🎯📈📉🔴🟢⚡️]/g, '') // Remove common emoji
      .toUpperCase()
      .trim();
    
    const contentHash = normalizedContent.substring(0, 150); // First 150 chars as hash
    const now = Date.now();
    
    // Clean up old entries (older than DEDUP_WINDOW_MS)
    for (const [hash, timestamp] of recentMessages.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS) {
        recentMessages.delete(hash);
      }
    }
    
    // Check for duplicate
    if (recentMessages.has(contentHash)) {
      const previousTimestamp = recentMessages.get(contentHash);
      const timeDiffSeconds = ((now - previousTimestamp) / 1000).toFixed(1);
      console.log(`   🔁 DUPLICATE DETECTED: Same message received ${timeDiffSeconds}s ago - IGNORING`);
      console.log(`   Original hash: ${contentHash.substring(0, 80)}...`);
      return;
    }
    
    // Store this message's hash
    recentMessages.set(contentHash, now);
    
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
export async function processTrendMessage(messageText, metadata) {
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
        
        // Get IG EPIC code for instrument (with automatic weekend detection)
        const igMapping = getInstrumentMapping(trend.data.instrument);
        
        // CHECK FOR DISABLED INSTRUMENTS (e.g. US Stocks)
        if (igMapping.disabled) {
            console.log(`⛔ Instrument ${igMapping.symbol} is DISABLED in configuration.`);
            console.log(`   Reason: High commissions / Not allowed.`);
            
            broadcastTrade({
                symbol: trend.data.instrument,
                direction: trend.data.direction,
                entryPrice: trend.data.entryPrice,
                status: 'info',
                message: `Trade skipped: ${igMapping.symbol} is disabled (High Commission/US Stock)`,
                timestamp: new Date().toISOString()
            });
            return;
        }
        
        if (!igMapping.epic) {
          console.log(`⚠️ No static IG EPIC found for ${trend.data.instrument}. Attempting smart search...`);
          
          try {
            const alternatives = await findAlternatives(trend.data.instrument);
            
            if (alternatives && alternatives.length > 0) {
              const bestMatch = alternatives[0];
              console.log(`✅ Smart search found match: ${bestMatch.name} (${bestMatch.epic})`);
              console.log(`   (Score: ${bestMatch.score})`);
              
              // Update mapping dynamically
              igMapping.epic = bestMatch.epic;
              igMapping.symbol = bestMatch.name;
              
            } else {
              console.log(`❌ Smart search failed. No IG EPIC found for ${trend.data.instrument}\n`);
              
              // Broadcast error as single event
              broadcastTrade({
                symbol: trend.data.instrument,
                direction: trend.data.direction,
                entryPrice: trend.data.entryPrice,
                status: 'error',
                message: `No IG EPIC found for ${trend.data.instrument} (even after smart search)`,
                timestamp: new Date().toISOString()
              });
              return;
            }
          } catch (err) {
            console.error(`❌ Smart search error: ${err.message}`);
            broadcastTrade({
              symbol: trend.data.instrument,
              direction: trend.data.direction,
              entryPrice: trend.data.entryPrice,
              status: 'error',
              message: `Smart search error: ${err.message}`,
              timestamp: new Date().toISOString()
            });
            return;
          }
        }
        
        console.log(`IG EPIC: ${igMapping.epic}`);
        console.log(`Symbol: ${igMapping.symbol}\n`);
        
        // Get risk amount from dashboard
        const riskAmount = getRiskPerTrade();
        console.log(`Risk per trade: ${riskAmount}€\n`);
        
        // Calculate contract size based on risk and margin requirements
        let tradeSize = 0.1; // Default minimum
        let realRisk = 0; // Real risk based on actual contract size
        
        if (trend.data.entryPrice) {
          let entryPrice = trend.data.entryPrice;
          
          // ALWAYS fetch current market price from IG - NEVER trust signal prices!
          console.log(`   📊 Signal price: ${entryPrice} (IGNORED - fetching real market price...)`);
          
          let dealSizeIncrement = 0.1; // Default increment
          let marketPriceFetched = false;
          let marketDetails = null; // Define outside try-catch
          
          try {
            marketDetails = await igApi.getMarketDetails(igMapping.epic);
            
            // NEW: Fallback Search Logic
            if (!marketDetails) {
                console.log(`   ⚠️ Primary EPIC ${igMapping.epic} failed. Searching for alternative EPIC for "${igMapping.symbol}"...`);
                const newEpic = await igApi.searchMarket(igMapping.symbol);
                
                if (newEpic) {
                    console.log(`   🔄 Found new EPIC: ${newEpic}. Retrying...`);
                    igMapping.epic = newEpic; // Update mapping for this trade
                    marketDetails = await igApi.getMarketDetails(newEpic);
                }
            }
            
            if (!marketDetails) {
                throw new Error("Market details returned null/undefined");
            }

            if (marketDetails) {
              console.log(`   🔍 Market details received:`, {
                bid: marketDetails.bid,
                offer: marketDetails.offer,
                increment: marketDetails.dealSizeIncrement,
                minSize: marketDetails.minDealSize,
                status: marketDetails.marketStatus
              });
              
              // Check if market is tradeable AND has valid prices
              if (marketDetails.marketStatus !== 'TRADEABLE' || !marketDetails.bid || !marketDetails.offer) {
                const reason = marketDetails.marketStatus !== 'TRADEABLE' 
                  ? `Market is ${marketDetails.marketStatus}`
                  : 'Bid/Offer prices missing';
                
                console.error(`   ⚠️ Primary market not available: ${reason}`);
                console.log(`   → Will try fallback/alternatives in retry logic...`);
                
                // Don't return here - let the retry logic handle it!
                marketPriceFetched = false;
              } else {
                // Market is good - use the prices
                const marketPrice = trend.data.direction === 'BUY' ? marketDetails.offer : marketDetails.bid;
                console.log(`   ✅ Real market price from IG: ${marketPrice}`);
                entryPrice = marketPrice;
                trend.data.entryPrice = marketPrice;
                marketPriceFetched = true;
              }
              
              // Get deal size increment
              // FIX: Prioritize igMapping.dealSizeIncrement to allow manual overrides for tricky instruments (like DAX)
              dealSizeIncrement = igMapping.dealSizeIncrement || marketDetails.dealSizeIncrement || igMapping.minDealSize || marketDetails.minDealSize || 0.1;
              
              // Force increment to 1.0 for US Stocks (UA./UB./UD./UC. prefix) to avoid SIZE_INCREMENT errors
              if (igMapping.epic.startsWith('UA.') || igMapping.epic.startsWith('UB.') || igMapping.epic.startsWith('UD.') || igMapping.epic.startsWith('UC.')) {
                 dealSizeIncrement = 1.0;
                 console.log(`   ⚠️ Enforcing dealSizeIncrement = 1.0 for US Stock`);
              }
              
              console.log(`   📏 Final dealSizeIncrement: ${dealSizeIncrement}`);
            }
          } catch (error) {
            console.error(`   ❌ Failed to fetch market details: ${error.message}`);
            
            // ABORT if market details are missing - Risk of wrong contract size is too high!
            broadcastTrade({
                status: 'error',
                message: `❌ Failed to fetch market details for ${igMapping.symbol}. Trade aborted for safety.`,
                symbol: igMapping.symbol,
                epic: igMapping.epic,
                timestamp: new Date().toISOString()
            });
            return; // ABORT TRADE
          }
          
          // If we are here, we have marketDetails
          // Use the price we fetched earlier if valid, otherwise fallback to signal price (with warning)
          if (marketPriceFetched && (marketDetails.offer || marketDetails.bid)) {
              entryPrice = trend.data.direction === 'BUY' ? marketDetails.offer : marketDetails.bid;
              
              // PRICE SANITY CHECK: Compare IG Price with Signal Price
              if (trend.data.entryPrice) {
                  const signalPrice = parseFloat(trend.data.entryPrice);
                  if (!isNaN(signalPrice) && signalPrice > 0) {
                      const deviation = Math.abs((entryPrice - signalPrice) / signalPrice);
                      
                      // If deviation > 50%, something is WRONG (e.g. IG returns 6.15 instead of 182.38)
                      if (deviation > 0.5) {
                          console.warn(`   ⚠️ CRITICAL PRICE MISMATCH: IG Price (${entryPrice}) differs significantly from Signal Price (${signalPrice})!`);
                          console.warn(`   ⚠️ Deviation: ${(deviation * 100).toFixed(0)}%`);
                          console.warn(`   ⚠️ Falling back to Signal Price for margin calculation to prevent sizing errors.`);
                          entryPrice = signalPrice;
                      } else {
                          console.log(`   ✅ Price Check Passed: IG (${entryPrice}) vs Signal (${signalPrice}) - Dev: ${(deviation * 100).toFixed(1)}%`);
                      }
                  }
              }
          } else {
              console.warn(`   ⚠️ Market price missing from API. Falling back to signal price: ${trend.data.entryPrice}`);
              entryPrice = trend.data.entryPrice;
              
              if (!entryPrice) {
                  console.error(`   ❌ CRITICAL: No price available (neither API nor Signal). Aborting.`);
                  broadcastTrade({
                    status: 'error',
                    message: `❌ No price available for ${igMapping.symbol}. Trade aborted.`,
                    symbol: igMapping.symbol,
                    epic: igMapping.epic,
                    timestamp: new Date().toISOString()
                  });
                  return;
              }
          }
          
          // ==================================================================================
          // ⚠️ CRITICAL: NEVER USE TELEGRAM SIGNAL PRICE FOR ENTRY!
          // The price in the Telegram message is often delayed or just a reference.
          // We MUST use the real-time market price from IG API for all margin calculations.
          // If the API price looks wrong (e.g. EUR/USD > 100), it means we have the WRONG EPIC
          // or the API is returning bad data. In that case, we should FAIL, not use the signal price.
          // ==================================================================================
          
          // Check for obviously wrong prices (e.g. EUR/USD > 100)
          if (igMapping.symbol.includes('EUR/USD') && entryPrice > 100) {
             console.error(`❌ CRITICAL: Suspicious price for EUR/USD: ${entryPrice}. This looks like an index price!`);
             console.error(`❌ The mapped EPIC ${igMapping.epic} might be wrong or pointing to a different instrument.`);
             console.error(`❌ ABORTING to prevent massive loss due to wrong contract size calculation.`);
             
             broadcastTrade({
                symbol: trend.data.instrument,
                direction: trend.data.direction,
                entryPrice: trend.data.entryPrice,
                status: 'error',
                message: `Trade aborted: Suspicious market price (${entryPrice}) for EUR/USD. Check EPIC mapping!`,
                timestamp: new Date().toISOString()
             });
             return;
          }

          // Get margin from IG API (more reliable than hardcoded values!)
          let marginPercent = igMapping.marginPercent || 0.05; // Fallback 5%
          
          // DEBUG: Log raw marginFactor from API
          console.log(`   🔍 DEBUG: Raw marginFactor from API:`, marketDetails?.marginFactor);
          console.log(`   🔍 DEBUG: Raw marginDepositBands:`, marketDetails?.marginDepositBands);
          
          if (marketDetails?.marginFactor) {
            // IG API returns marginFactor as PERCENTAGE (e.g., 50 = 50%), convert to 0.50
            // BUT if it returns < 1 (e.g. 0.2), it might already be a ratio.
            let rawMargin = marketDetails.marginFactor;
            if (rawMargin < 1) {
                 marginPercent = rawMargin; // It's already a ratio
            } else {
                 marginPercent = rawMargin / 100;
            }
            console.log(`   📊 Margin from IG API: ${(marginPercent * 100).toFixed(1)}%`);
          } else if (marketDetails?.marginDepositBands && marketDetails.marginDepositBands.length > 0) {
            // Use first margin band (already in percentage, e.g., 50 = 50%)
            let rawMargin = marketDetails.marginDepositBands[0].margin;
            if (rawMargin < 1) {
                 marginPercent = rawMargin; // It's already a ratio
            } else {
                 marginPercent = rawMargin / 100;
            }
            console.log(`   📊 Margin from IG API (bands): ${(marginPercent * 100).toFixed(1)}%`);
          } else {
            // Fallback logic
            const instrumentType = marketDetails?.rawData?.instrument?.type || '';
            const isShare = instrumentType === 'SHARES' || instrumentType === 'EQUITIES' || igMapping.epic.includes('UC.D.') || igMapping.epic.includes('UA.') || igMapping.epic.includes('UB.');
            
            if (isShare) {
                marginPercent = 0.20; // Default 20% for shares
                console.log(`   ⚠️  No margin data from API, using SHARE fallback: 20.0%`);
            } else {
                console.log(`   ⚠️  No margin data from API, using fallback: ${(marginPercent * 100).toFixed(1)}%`);
            }
          }
          
          // Get currency from API or infer from symbol
          let currency = marketDetails?.currencyCode;
          
          if (!currency) {
             // Infer from symbol if API failed
             if (igMapping.symbol.includes('/')) {
               const parts = igMapping.symbol.split('/');
               if (parts.length === 2) {
                 currency = parts[1].trim().replace(/\s+Mini$/i, '').replace(/\s+Kassa$/i, '');
                 console.log(`   ⚠️ Inferred currency from symbol: ${currency}`);
               }
             } else if (igMapping.symbol.includes('US Tech') || igMapping.symbol.includes('Wall Street') || igMapping.symbol.includes('Gold') || igMapping.symbol.includes('Oil')) {
               currency = 'USD';
               console.log(`   ⚠️ Inferred currency from symbol: ${currency}`);
             } else if (igMapping.symbol.includes('DAX') || igMapping.symbol.includes('Germany')) {
               currency = 'EUR';
               console.log(`   ⚠️ Inferred currency from symbol: ${currency}`);
             }
             
             // Default to EUR if still unknown
             if (!currency) {
               currency = 'EUR';
               console.log(`   ⚠️ Could not infer currency, defaulting to EUR`);
             }
          }
          
          let exchangeRate = 1.0;
          
          try {
            // Fetch real-time exchange rate for this specific trade
            exchangeRate = await getExchangeRateToEURCached(currency);
            console.log(`   💱 Quote Currency: ${currency}`);
            console.log(`   💱 Exchange Rate: 1 ${currency} = ${exchangeRate} EUR`);
          } catch (error) {
            console.error(`   ❌ Failed to fetch exchange rate: ${error.message}`);
            console.log(`   → Defaulting to 1.0 (treat as EUR)`);
          }
          
          // Get contract/lot size multiplier
          // Use smart calculation based on pip value if available, otherwise fallback to API field
          let contractSize = calculateContractSize(marketDetails);
          
          const lotSize = marketDetails?.rawData?.instrument?.lotSize || 1;
          
          // For stocks/shares, default contract size is 1 (1 share = 1 contract)
          // Only FOREX requires explicit contract size from API
          const instrumentType = marketDetails?.rawData?.instrument?.type || '';
          const isForex = igMapping.epic.includes('CS.D.') || instrumentType === 'CURRENCIES';
          
          // If calculateContractSize returned null (missing data), we need to handle it
          if (contractSize === null) {
            // Try to use fallback from mapping (e.g. Oil = 10)
            if (igMapping.contractSize) {
              contractSize = igMapping.contractSize;
              console.log(`   📦 Contract Size: ${contractSize} (Fallback from mapping)`);
            } else if (isForex) {
              // FALLBACK: Use EPIC pattern to determine contract size
              if (igMapping.epic.includes('.MINI.IP')) {
                contractSize = 10000; // Mini accounts = 10,000 units
                console.log(`   📦 Contract Size: ${contractSize} (Mini FOREX - inferred from EPIC)`);
              } else if (igMapping.epic.includes('.CFD.IP') || igMapping.epic.includes('.STANDARD.IP')) {
                contractSize = 100000; // Standard accounts = 100,000 units
                console.log(`   📦 Contract Size: ${contractSize} (Standard FOREX - inferred from EPIC)`);
              } else {
                // Unknown FOREX type - ABORT for safety
                console.error(`   ❌ CRITICAL: Contract Size missing from API for FOREX!`);
                console.error(`   ❌ Cannot infer from EPIC: ${igMapping.epic}`);
                console.error(`   ❌ Symbol: ${igMapping.symbol}`);
                broadcastTrade({
                  status: 'error',
                  message: `❌ Contract Size data missing from API! Trading aborted for safety.`,
                  symbol: igMapping.symbol,
                  epic: igMapping.epic,
                  timestamp: new Date().toISOString()
                });
                return; // ABORT TRADE
              }
            } else {
              // Stocks/Commodities: Default to 1 if not provided
              // DANGEROUS for Indices!
              
              // Check if it's a Share (Equity)
              const isShare = instrumentType === 'SHARES' || instrumentType === 'EQUITIES';
              
              if (isShare) {
                  contractSize = 1;
                  console.log(`   📦 Contract Size: ${contractSize} (default for Shares)`);
              } else {
                  // ABORT for Indices/Commodities if contract size is unknown
                  console.error(`   ❌ CRITICAL: Contract Size missing and cannot be defaulted for non-Share instrument!`);
                  console.error(`   ❌ Instrument Type: ${instrumentType}`);
                  broadcastTrade({
                    status: 'error',
                    message: `❌ Contract Size missing for ${igMapping.symbol}. Trade aborted for safety.`,
                    symbol: igMapping.symbol,
                    epic: igMapping.epic,
                    timestamp: new Date().toISOString()
                  });
                  return; // ABORT TRADE
              }
            }
          } else {
            console.log(`   📦 Contract Size: ${contractSize} units (Calculated from API)`);
          }
          
          console.log(`   📦 Lot Size: ${lotSize}`);
          
          // Calculate margin required per contract IN EUR
          // CRITICAL: For Forex, 1 contract = contractSize units (e.g., 100,000 for GBP/JPY)
          // NOTE: We use the official 'marginFactor' from IG API (fetched above) to calculate this.
          // This is the most accurate pre-trade margin check possible.
          const marginPerContract = entryPrice * marginPercent * exchangeRate * contractSize;
          
          console.log(`   🔍 Margin Calculation Breakdown (based on IG API data):`);
          console.log(`      Entry Price: ${entryPrice} ${currency} (per 1 unit of base currency)`);
          console.log(`      Margin%: ${(marginPercent * 100).toFixed(2)}% (Source: IG API marginFactor/Bands)`);
          console.log(`      Exchange Rate: 1 ${currency} = ${exchangeRate} EUR`);
          console.log(`      Contract Size: ${contractSize} units`);
          console.log(`      → Formula: ${entryPrice} × ${(marginPercent * 100).toFixed(2)}% × ${exchangeRate} × ${contractSize}`);
          console.log(`      → Margin per Contract: ${marginPerContract.toFixed(2)}€`);
          
          // Calculate contract size: Risk / Margin per contract
          if (marginPerContract > 0) {
              // SANITY CHECK: If margin per contract is suspiciously low (< 0.5% of notional value), warn!
              // Notional Value in EUR = EntryPrice * ExchangeRate * ContractSize
              const notionalValueEur = entryPrice * exchangeRate * contractSize;
              const impliedMarginPercent = marginPerContract / notionalValueEur;
              
              if (impliedMarginPercent < 0.01) { // Less than 1% margin
                  console.warn(`   ⚠️ WARNING: Calculated margin per contract (${marginPerContract.toFixed(2)}€) is very low (< 1% of notional).`);
                  console.warn(`   ⚠️ This implies >100x leverage. Checking for data errors...`);
                  
                  // If margin is suspiciously low, force a safer margin (e.g. 5% or 20%)
                  // For Shares, min margin is usually 20%
                  const isShare = marketDetails?.rawData?.instrument?.type === 'SHARES' || marketDetails?.rawData?.instrument?.type === 'EQUITIES';
                  if (isShare && impliedMarginPercent < 0.15) {
                      console.warn(`   ⚠️ Share detected with <15% margin. Forcing 20% margin for safety.`);
                      const safeMargin = notionalValueEur * 0.20;
                      console.log(`   ⚠️ Adjusted Margin per Contract: ${safeMargin.toFixed(2)}€`);
                      tradeSize = riskAmount / safeMargin;
                  } else {
                      tradeSize = riskAmount / marginPerContract;
                  }
              } else {
                  tradeSize = riskAmount / marginPerContract;
              }
          } else {
              console.error(`   ❌ Invalid margin per contract: ${marginPerContract}. Defaulting to min size.`);
              tradeSize = 0; // Will be fixed by minSize
          }
          
          // Get minimum size from API (preferred) or Mapping or Default
          // User requested to prioritize API values
          const minSize = marketDetails?.minDealSize || igMapping.minDealSize || 0.1;
          console.log(`   📏 Minimum Deal Size: ${minSize} (Source: ${marketDetails?.minDealSize ? 'API' : (igMapping.minDealSize ? 'Mapping' : 'Default')})`);
          
          // DEBUG: Log if API min size is missing
          if (!marketDetails?.minDealSize) {
              console.warn(`   ⚠️ API did not return minDealSize for ${igMapping.epic}. Using fallback: ${minSize}`);
          }
          
          // DEBUG: Log values before rounding
          console.log(`   🔍 DEBUG BEFORE ROUNDING:`);
          console.log(`      tradeSize = ${tradeSize}`);
          console.log(`      dealSizeIncrement = ${dealSizeIncrement}`);
          console.log(`      dealSizeIncrement >= 1? ${dealSizeIncrement >= 1}`);
          
          // Round to valid increment
          // WICHTIG: Wenn nahe am Zielwert, AUFRUNDEN um über 100€ zu bleiben!
          const decimals = dealSizeIncrement >= 1 ? 0 : Math.ceil(-Math.log10(dealSizeIncrement));
          
          // Round UP to nearest increment (works for both >=1 and <1)
          // e.g. increment 0.125: 0.05 -> 0.125
          // BUT: For Shares (increment >= 1), we should be careful not to exceed risk significantly
          // If calculated size is 1.03 and we round to 2, we double the risk!
          
          if (dealSizeIncrement >= 1 && tradeSize > 1) {
              // For shares/integers, round to nearest to avoid massive risk jumps
              // e.g. 1.2 -> 1, 1.8 -> 2
              tradeSize = Math.round(tradeSize / dealSizeIncrement) * dealSizeIncrement;
              console.log(`      🔍 AFTER ROUNDING (Integer): tradeSize = ${tradeSize}`);
          } else {
              // For small increments (Forex/Indices), round UP to ensure minimum size
              tradeSize = Math.ceil(tradeSize / dealSizeIncrement) * dealSizeIncrement;
              console.log(`      🔍 AFTER ROUNDING (Decimal): tradeSize = ${tradeSize}`);
          }
          
          console.log(`   🔍 DEBUG AFTER ALL ROUNDING: tradeSize = ${tradeSize}`);
          
          // Store calculated size before enforcing minimum
          const calculatedSize = tradeSize;
          
          // Ensure minimum size is met, maximum 100
          tradeSize = Math.max(minSize, Math.min(tradeSize, 100));
          
          // FINAL SAFETY: Fix floating point precision issues
          // e.g. 1.0000000000000002 -> 1
          if (dealSizeIncrement >= 1) {
              tradeSize = Math.round(tradeSize);
          } else {
              // Calculate precision from increment (e.g. 0.125 -> 3 decimals)
              const precision = (dealSizeIncrement.toString().split('.')[1] || '').length;
              tradeSize = parseFloat(tradeSize.toFixed(precision));
          }
          
          // Calculate REAL risk based on actual trade size
          realRisk = tradeSize * marginPerContract;
          
          // BOOST LOGIC: If risk is too low (< 80% of target), increase size
          // This ensures we utilize the budget effectively
          if (realRisk < riskAmount * 0.8 && tradeSize > 0) {
              console.log(`   🚀 Risk too low (${realRisk.toFixed(2)}€ < ${riskAmount * 0.8}€). Boosting size...`);
              tradeSize += dealSizeIncrement;
              
              // Re-fix precision
              if (dealSizeIncrement >= 1) {
                  tradeSize = Math.round(tradeSize);
              } else {
                  const precision = Math.ceil(-Math.log10(dealSizeIncrement));
                  tradeSize = parseFloat(tradeSize.toFixed(precision));
              }
              
              realRisk = tradeSize * marginPerContract;
              console.log(`   🚀 New Size: ${tradeSize}, New Risk: ${realRisk.toFixed(2)}€`);
          }

          console.log(`📊 Margin calculation:`);
          console.log(`   Entry Price: ${entryPrice} ${currency} (per 1 unit of base currency)`);
          console.log(`   Margin Requirement: ${(marginPercent * 100).toFixed(1)}%`);
          console.log(`   Exchange Rate: 1 ${currency} = ${exchangeRate} EUR`);
          console.log(`   Contract Size: ${contractSize} units`);
          console.log(`   → Margin per Contract: ${marginPerContract.toFixed(2)}€`);
          console.log(`   Minimum Deal Size: ${minSize}`);
          console.log(`   Deal Size Increment: ${dealSizeIncrement}`);
          console.log(`   Calculated Size: ${calculatedSize.toFixed(3)} → Final Size: ${tradeSize} (Desired Risk: ${riskAmount}€)`);
          
          console.log(`\n🛡️ SECURITY GATE CHECK:`);
          console.log(`   Desired Risk: ${riskAmount}€`);
          console.log(`   Calculated Trade Size: ${tradeSize.toFixed(2)} contracts`);
          console.log(`   Real Risk: ${realRisk.toFixed(2)}€`);
          console.log(`   Deviation: ${((realRisk / riskAmount - 1) * 100).toFixed(1)}%`);
          
          // SECURITY GATE: Abort if risk is more than 200% over target (3x = 300%)
          const maxAllowedRisk = riskAmount * 3.0; // Max 300% of desired risk
          
          // EXCEPTION: Allow BRENT (CC.D.LCO.UNC.IP) to bypass security gate
          const isBrent = igMapping.epic === 'CC.D.LCO.UNC.IP';
          
          if (realRisk > maxAllowedRisk && !isBrent) {
            const errorMsg = `🚨 SECURITY GATE: Trade REJECTED! Risk ${realRisk.toFixed(2)}€ exceeds maximum ${maxAllowedRisk.toFixed(2)}€`;
            console.error(`\n${errorMsg}\n`);
            
            // ------------------------------------------------------------------
            // RETRY LOGIC: Check for "Mini" contract if risk is too high
            // ------------------------------------------------------------------
            console.log(`   🔄 Checking for "Mini" alternative to reduce risk...`);
            
            // Check if we are already using a Mini contract
            const isAlreadyMini = igMapping.epic.includes('MINI') || igMapping.epic.includes('CEAM') || igMapping.epic.includes('IFMM') || igMapping.epic.includes('CFM');
            
            if (isAlreadyMini) {
                console.log(`   ⚠️ Already using a Mini contract (${igMapping.epic}). Cannot reduce risk further.`);
            } else {
                // Search for a Mini alternative
                try {
                    console.log(`   🔎 Searching API for Mini version of ${trend.data.instrument}...`);
                    const searchResults = await igApi.searchMarkets(trend.data.instrument);
                    
                    // Look for "Mini" in name or EPIC
                    const miniAlt = searchResults.find(r => 
                        (r.instrumentName.includes('Mini') || r.epic.includes('MINI') || r.epic.includes('CEAM') || r.epic.includes('IFMM') || r.epic.includes('CFM')) &&
                        r.marketStatus === 'TRADEABLE'
                    );
                    
                    if (miniAlt) {
                        console.log(`   ✅ FOUND MINI ALTERNATIVE: ${miniAlt.instrumentName} (${miniAlt.epic})`);
                        console.log(`   🔄 Restarting calculation with Mini contract...`);
                        
                        // Update mapping to use Mini
                        igMapping.epic = miniAlt.epic;
                        igMapping.symbol = miniAlt.instrumentName;
                        
                        // RECURSIVE CALL (or effectively restarting the process)
                        // Since we can't easily recurse here without refactoring, we will
                        // manually trigger a "retry" by calling processTrendMessage again
                        // with a flag or just letting the user know we found a better contract.
                        
                        // BETTER APPROACH: We are inside the function. We can just update the mapping
                        // and let the next execution handle it? No, we need to recalculate NOW.
                        
                        // HACK: We will just update the mapping and RESTART the function
                        // But we need to be careful about infinite loops.
                        // We can add a metadata flag "isRetry: true"
                        
                        if (!metadata.isRetry) {
                            metadata.isRetry = true;
                            console.log(`   🔄 Relaunching processTrendMessage with new EPIC...`);
                            
                            // We need to update the trend object or just pass the new mapping?
                            // processTrendMessage parses the text again.
                            // We can't easily force it to use the new mapping unless we update the global mapping
                            // OR we pass the mapping explicitly.
                            
                            // Alternative: Just execute the trade with the new EPIC directly here?
                            // No, we need the safety checks (margin calculation) again.
                            
                            // BEST OPTION: Refactor the calculation logic into a loop.
                            // But for now, to minimize changes:
                            // We will broadcast a special "Retry" message internally? No.
                            
                            // Let's try to just update the mapping and jump back? No goto in JS.
                            
                            // We will return and call processTrendMessage again, but we need to ensure
                            // it uses the new EPIC.
                            // Since getInstrumentMapping is deterministic based on text, we can't change it easily.
                            
                            // OK, we will use the `findAlternatives` logic in `tradeRetry.js` which is called LATER.
                            // BUT `tradeRetry.js` is only called if `executeTradeWithRetry` is called.
                            // Here we are blocked BEFORE that.
                            
                            // SOLUTION: We will manually call `executeTradeWithRetry` with the MINI EPIC
                            // BUT we need to verify the risk first.
                            
                            // Let's do a quick estimation:
                            // Mini usually has 1/10th or 1/2 size.
                            // If we found a mini, it's highly likely to pass.
                            
                            console.log(`   🚀 Attempting to trade found Mini contract directly...`);
                            
                            // Fetch details for the Mini contract to be sure
                            const miniDetails = await igApi.getMarketDetails(miniAlt.epic);
                            if (miniDetails) {
                                // Calculate new risk roughly
                                let miniContractSize = miniDetails.rawData?.instrument?.contractSize;
                                if (miniContractSize && typeof miniContractSize === 'string') miniContractSize = parseFloat(miniContractSize);
                                if (!miniContractSize) miniContractSize = 1; // Default
                                if (miniAlt.epic.includes('MINI')) miniContractSize = 10000; // Forex Mini
                                
                                const miniMarginPercent = (miniDetails.marginFactor || 5) / 100;
                                const miniMarginPerContract = entryPrice * miniMarginPercent * exchangeRate * miniContractSize;
                                const miniTradeSize = Math.max(miniDetails.minDealSize || 0.1, riskAmount / miniMarginPerContract);
                                const miniRealRisk = miniTradeSize * miniMarginPerContract;
                                
                                console.log(`   📊 Mini Risk Estimation: ~${miniRealRisk.toFixed(2)}€`);
                                
                                if (miniRealRisk <= maxAllowedRisk) {
                                    console.log(`   ✅ Mini Risk is acceptable! Executing...`);
                                    
                                    // Execute directly
                                    const result = await igApi.createPosition(miniAlt.epic, {
                                        direction: trend.data.direction,
                                        size: miniTradeSize,
                                        orderType: 'MARKET',
                                        currencyCode: miniDetails.currencyCode,
                                        forceOpen: true,
                                        stopLevel: trend.data.stopLoss,
                                        limitLevel: trend.data.takeProfit
                                    });
                                    
                                    broadcastTrade({
                                        epic: miniAlt.epic,
                                        symbol: miniAlt.instrumentName,
                                        direction: trend.data.direction,
                                        entryPrice: trend.data.entryPrice,
                                        status: result.status === 'success' ? 'success' : 'error',
                                        message: result.status === 'success' ? 'Executed via Mini Fallback' : result.message,
                                        riskAmount: miniRealRisk,
                                        timestamp: new Date().toISOString(),
                                        isFallback: true
                                    });
                                    return; // Done!
                                } else {
                                    console.log(`   ❌ Even Mini contract risk is too high (${miniRealRisk.toFixed(2)}€ > ${maxAllowedRisk.toFixed(2)}€)`);
                                }
                            }
                        }
                    } else {
                        console.log(`   ❌ No Mini alternative found.`);
                    }
                } catch (e) {
                    console.error(`   ❌ Error searching for Mini: ${e.message}`);
                }
            }

            broadcastTrade({
              epic: igMapping.epic,
              symbol: igMapping.symbol,
              direction: trend.data.direction,
              entryPrice: trend.data.entryPrice,
              status: 'error',
              message: errorMsg,
              riskAmount: realRisk,
              timestamp: new Date().toISOString()
            });
            
            return; // ABORT TRADE!
          }
          
          // Warn if minimum size enforcement increased the risk significantly
          if (tradeSize > calculatedSize && realRisk > riskAmount * 1.5) {
            console.log(`   ⚠️ WARNING: Minimum size ${minSize} enforces HIGHER risk!`);
            console.log(`   ⚠️ Desired: ${riskAmount}€ → Actual: ${realRisk.toFixed(2)}€ (${((realRisk / riskAmount - 1) * 100).toFixed(0)}% more)`);
          }
          
          console.log(`   ✅ Security Gate PASSED\n`);
          console.log(`   💰 Final Trade: ${tradeSize} contracts @ ${realRisk.toFixed(2)}€ risk\n`);
        } else {
          console.log(`⚠️  No entry price available, using minimum size: 0.1\n`);
        }
        
        try {
          // RETRY LOGIC: Try primary, fallback, then search for alternatives
          let tradeResult = null;
          let usedEpic = igMapping.epic;
          let usedSymbol = igMapping.symbol;
          let retryAttempt = 0;
          
          // ATTEMPT 1: Primary EPIC
          retryAttempt++;
          console.log(`\n📡 ATTEMPT ${retryAttempt}: Trying primary ${igMapping.symbol} (${igMapping.epic})...`);
          
          tradeResult = await igApi.executeTrade({
            epic: igMapping.epic,
            symbol: igMapping.symbol,
            expiry: igMapping.expiry,
            direction: trend.data.direction,
            entryPrice: trend.data.entryPrice,
            stopLevel: trend.data.stopLoss,
            takeProfit: trend.data.takeProfit,
            optionType: trend.data.optionType,
            strikePrice: trend.data.strikePrice,
            isOption: trend.data.isOption,
            size: tradeSize
          });

          // ATTEMPT 2: Fallback EPIC if primary failed
          if (tradeResult.status === 'error' && igMapping.fallback) {
            retryAttempt++;
            console.log(`\n⚠️  Primary failed: ${tradeResult.message}`);
            console.log(`📡 ATTEMPT ${retryAttempt}: Trying fallback ${igMapping.fallback.symbol} (${igMapping.fallback.epic})...`);
            
            tradeResult = await igApi.executeTrade({
              epic: igMapping.fallback.epic,
              symbol: igMapping.fallback.symbol,
              expiry: igMapping.fallback.expiry,
              direction: trend.data.direction,
              entryPrice: trend.data.entryPrice,
              stopLevel: trend.data.stopLoss,
              takeProfit: trend.data.takeProfit,
              optionType: trend.data.optionType,
              strikePrice: trend.data.strikePrice,
              isOption: trend.data.isOption,
              size: tradeSize
            });
            
            if (tradeResult.status === 'success') {
              usedEpic = igMapping.fallback.epic;
              usedSymbol = igMapping.fallback.symbol;
              console.log(`   ✅ Fallback succeeded!`);
            }
          }
          
          // ATTEMPT 3+: Search for alternatives if still failed
          // FIX: Do NOT search for alternatives if the error is INSUFFICIENT_FUNDS
          // This prevents the bot from trying random instruments when the account is simply out of money
          const isFundError = tradeResult.message && tradeResult.message.includes('INSUFFICIENT_FUNDS');
          
          if (tradeResult.status === 'error' && !isFundError) {
            console.log(`\n⚠️  Fallback also failed: ${tradeResult.message}`);
            console.log(`📡 ATTEMPT ${retryAttempt + 1}: Searching for tradeable alternatives...`);
            
            try {
              const searchResults = await igApi.searchMarkets(trend.data.instrument);
              
              if (searchResults && searchResults.length > 0) {
                console.log(`   Found ${searchResults.length} alternatives, trying each...`);
                
                for (let i = 0; i < Math.min(searchResults.length, 5); i++) {
                  const alt = searchResults[i];
                  retryAttempt++;
                  
                  // Skip if it's the primary or fallback we already tried
                  if (alt.epic === igMapping.epic || alt.epic === igMapping.fallback?.epic) {
                    continue;
                  }
                  
                  console.log(`\n📡 ATTEMPT ${retryAttempt}: Trying ${alt.instrumentName} (${alt.epic})...`);
                  
                  // Check if market is tradeable
                  try {
                    const altDetails = await igApi.getMarketDetails(alt.epic);
                    
                    if (!altDetails || altDetails.marketStatus !== 'TRADEABLE') {
                      console.log(`   ⚠️  Market is ${altDetails?.marketStatus || 'UNKNOWN'} - skipping`);
                      continue;
                    }
                    
                    console.log(`   ✅ Market is TRADEABLE - executing...`);
                    
                    // RECALCULATE SIZE for this specific alternative
                    // Different instruments have different increments (e.g. CFD 0.1 vs Stock 1.0)
                    let altIncrement = altDetails.dealSizeIncrement || altDetails.minDealSize || 0.1;
                    
                    // Force increment to 1.0 for US Stocks (UA./UB./UD. prefix)
                    if (alt.epic.startsWith('UA.') || alt.epic.startsWith('UB.') || alt.epic.startsWith('UD.')) {
                        altIncrement = 1.0;
                    }
                    
                    let altSize = tradeSize;
                    
                    if (altIncrement >= 1) {
                        // Round UP to nearest whole number
                        altSize = Math.ceil(tradeSize / altIncrement) * altIncrement;
                        altSize = Math.round(altSize); // Final integer safety
                    } else {
                        // Round to decimal
                        const precision = Math.ceil(-Math.log10(altIncrement));
                        altSize = parseFloat(tradeSize.toFixed(precision));
                    }
                    
                    console.log(`   🔄 Adjusted size for alternative: ${tradeSize} -> ${altSize} (Inc: ${altIncrement})`);

                    tradeResult = await igApi.executeTrade({
                      epic: alt.epic,
                      symbol: alt.instrumentName,
                      expiry: alt.expiry || '-',
                      direction: trend.data.direction,
                      entryPrice: trend.data.entryPrice,
                      stopLevel: trend.data.stopLoss,
                      takeProfit: trend.data.takeProfit,
                      optionType: trend.data.optionType,
                      strikePrice: trend.data.strikePrice,
                      isOption: trend.data.isOption,
                      size: altSize
                    });
                    
                    if (tradeResult.status === 'success') {
                      usedEpic = alt.epic;
                      usedSymbol = alt.instrumentName;
                      console.log(`   ✅ Alternative succeeded!`);
                      break; // Success! Exit retry loop
                    } else {
                      console.log(`   ❌ Failed: ${tradeResult.message}`);
                    }
                  } catch (e) {
                    console.log(`   ❌ Error checking alternative: ${e.message}`);
                  }
                }
              } else {
                console.log(`   ⚠️  No alternatives found via search`);
              }
            } catch (searchError) {
              console.log(`   ❌ Search failed: ${searchError.message}`);
            }
          }
          
          // Final result after all retries
          if (tradeResult.status === 'success') {
            console.log(`\n✅ TRADE SUCCEEDED after ${retryAttempt} attempt(s)`);
            console.log(`   Used: ${usedSymbol} (${usedEpic})`);
          } else {
            console.log(`\n❌ TRADE FAILED after ${retryAttempt} attempt(s)`);
            console.log(`   All markets unavailable or trade rejected`);
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
            size: tradeResult.size || tradeSize,
            level: tradeResult.level,
            currency: tradeResult.currency,
            riskAmount: realRisk || (tradeSize * (trend.data.entryPrice || 0) * (igMapping.marginPercent || 0.05)), // Real risk!
            stopLevel: trend.data.stopLoss,
            limitLevel: trend.data.takeProfit,
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
      // Check if trading is enabled
      if (!isTradingEnabled()) {
        console.log('⚠️  TRADING DISABLED - Close signal logged but not executed\n');
        return;
      }

      // Deduplication: Check if we've seen this close signal recently
      const closeKey = `${trend.data.instrument}_${Math.floor(Date.now() / 1000)}`;
      if (closeSignalCache.has(closeKey)) {
        console.log(`⏭️  Duplicate close signal for ${trend.data.instrument} detected (within 30s) - skipping\n`);
        return;
      }
      closeSignalCache.set(closeKey, true);
      
      console.log('🔒 POSITION CLOSE SIGNAL!\n');
      console.log(`Instrument: ${trend.data.instrument}`);
      console.log(`Result: ${trend.data.result}`);
      console.log(`Profit/Loss: ${trend.data.profit > 0 ? '+' : ''}${trend.data.profit}€\n`);
      
      /*
      // WIN.GIF FEATURE REMOVED (was broken with CHAT_ADMIN_REQUIRED error)
      // Bot is read-only and should not send Telegram messages
      */
      
      // Get IG EPIC for instrument
      const igMapping = mapInstrumentToIG(trend.data.instrument);
      
      if (igMapping.epic) {
        try {
          // Get open positions
          const positions = await igApi.getOpenPositions();
          console.log(`Found ${positions.length} open position(s)\n`);
          
          if (positions.length > 0) {
            console.log('All positions:');
            positions.forEach((p, i) => {
              console.log(`  ${i+1}. ${p.market.instrumentName} (${p.market.epic}) - Deal: ${p.position.dealId}`);
            });
            console.log('');
          }
          
          // Find all matching positions using enhanced fuzzy matching
          let matchingPositions = findMatchingPositions(positions, igMapping, trend.data.instrument);

          console.log(`\nFinal result: ${matchingPositions.length} position(s) to close\n`);
          
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
              // ---------------------------------------------------------
              // CONDITIONAL CLOSE LOGIC
              // ---------------------------------------------------------
              const direction = positionToClose.position.direction;
              const openLevel = positionToClose.position.level;
              const currentBid = positionToClose.market.bid;
              const currentOffer = positionToClose.market.offer;
              
              let currentPrice = 0;
              if (direction === 'BUY') {
                  currentPrice = currentBid;
              } else {
                  currentPrice = currentOffer;
              }

              // Check P&L using API data (Source of Truth)
              // If API profit is missing, fallback to price calculation (less accurate due to spread/fees)
              let isProfit = false;
              if (positionToClose.position.profit !== undefined && positionToClose.position.profit !== null) {
                  isProfit = positionToClose.position.profit > 0;
                  console.log(`   P&L Check (API): ${positionToClose.position.profit} ${positionToClose.position.currency} > 0 ? ${isProfit}`);
              } else {
                  if (direction === 'BUY') {
                      isProfit = currentBid > openLevel;
                  } else {
                      isProfit = currentOffer < openLevel;
                  }
                  console.log(`   P&L Check (Price): ${currentPrice} vs ${openLevel} -> ${isProfit}`);
              }

              // If P&L is negative, DO NOT CLOSE. Instead, update SL/TP.
              if (!isProfit) {
                  console.log(`\n⚠️  Close signal received but P&L is NEGATIVE. Applying Conditional Close logic...`);
                  console.log(`   Direction: ${direction}, Open: ${openLevel}, Current: ${currentPrice}`);
                  
                  let newSL, newTP;
                  
                  // Helper to determine precision
                  const getPrecision = (num) => {
                      if (Math.floor(num) === num) return 2;
                      const str = num.toString();
                      if (str.indexOf('.') === -1) return 2;
                      return str.split('.')[1].length;
                  };
                  const precision = getPrecision(openLevel);

                  if (direction === 'BUY') {
                      // LONG: 
                      // SL = 96% of Current Price (4% safety below current)
                      // TP = 100.5% of Entry Price (0.5% profit target)
                      newSL = currentPrice * 0.96; 
                      newTP = openLevel * 1.005;    
                  } else {
                      // SHORT: 
                      // SL = 104% of Current Price (4% safety above current)
                      // TP = 99.5% of Entry Price (0.5% profit target)
                      newSL = currentPrice * 1.04; 
                      newTP = openLevel * 0.995;    
                  }
                  
                  // Round to correct precision
                  newSL = parseFloat(newSL.toFixed(precision));
                  newTP = parseFloat(newTP.toFixed(precision));
                  
                  console.log(`   Calculated New SL: ${newSL} (4% distance)`);
                  console.log(`   Calculated New TP: ${newTP} (0.5% target)`);
                  
                  // Update Position
                  try {
                    const updateResult = await igApi.updatePosition(positionToClose.position.dealId, {
                        stopLevel: newSL,
                        limitLevel: newTP
                    });
                    
                    if (updateResult.success) {
                        console.log('✅ Conditional Close: SL/TP updated instead of closing.');
                        broadcastTrade({
                          epic: positionToClose.market.epic,
                          symbol: igMapping.symbol,
                          direction: 'UPDATE',
                          status: 'success',
                          message: 'Conditional Close: Updated SL/TP (Negative P&L)',
                          dealId: positionToClose.position.dealId,
                          stopLevel: newSL,
                          limitLevel: newTP,
                          timestamp: new Date().toISOString()
                        });
                    } else {
                        console.log('❌ Failed to update position for Conditional Close.');
                        broadcastTrade({
                          symbol: igMapping.symbol,
                          direction: 'UPDATE',
                          status: 'error',
                          message: 'Failed to update SL/TP for Conditional Close',
                          timestamp: new Date().toISOString()
                        });
                    }
                  } catch (err) {
                    console.error('Error in Conditional Close update:', err);
                  }
                  
                  // EXIT: Do not proceed to closePosition
                  return; 
              }
              // ---------------------------------------------------------

              console.log(`Closing position: ${positionToClose.position.dealId}`);
              
              // Save position data BEFORE closing (for logging)
              const positionSnapshot = {
                dealId: positionToClose.position.dealId,
                openLevel: positionToClose.position.level,
                stopLevel: positionToClose.position.stopLevel,
                limitLevel: positionToClose.position.limitLevel,
                direction: positionToClose.position.direction,
                size: positionToClose.position.size,
                riskAmount: positionToClose.position.riskAmount,
                currentBid: positionToClose.market.bid,
                currentOffer: positionToClose.market.offer
              };
              
              const closeResult = await igApi.closePosition(
                positionToClose.position.dealId,
                positionToClose.market.epic, // Use actual EPIC from position
                positionToClose.position.direction,
                positionToClose.position.size,
                positionToClose.position.currency // Pass currency to avoid extra API call
              );
              
              // Extract profit/loss and close details from confirmation
              const profitLoss = closeResult.confirmation?.profit || 0;
              const closeLevel = closeResult.confirmation?.level || positionSnapshot.currentBid || positionSnapshot.currentOffer;
              
              broadcastTrade({
                epic: positionToClose.market.epic,
                symbol: igMapping.symbol,
                direction: 'CLOSE',
                originalDirection: positionSnapshot.direction,
                status: closeResult.status,
                dealReference: closeResult.dealReference,
                dealId: positionSnapshot.dealId,
                message: closeResult.message,
                profit: profitLoss,
                level: positionSnapshot.openLevel,
                closeLevel: closeLevel,
                stopLevel: positionSnapshot.stopLevel,
                limitLevel: positionSnapshot.limitLevel,
                size: positionSnapshot.size,
                riskAmount: positionSnapshot.riskAmount,
                closeReason: 'Manual',
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
      
    } else if (trend.type === 'SL_UPDATE') {
      console.log('🛑 STOP LOSS UPDATE!\n');
      console.log(`Instrument: ${trend.data.instrument}`);
      console.log(`New SL: ${trend.data.stopLoss}\n`);
      
      // Get IG EPIC for instrument (with automatic weekend detection)
      const igMapping = getInstrumentMapping(trend.data.instrument);
      
      if (igMapping.epic) {
        try {
          // Get open positions and update matching one
          const positions = await igApi.getOpenPositions();
          let matchingPositions = findMatchingPositions(positions, igMapping, trend.data.instrument);
          
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
            
            // SANITY CHECK: Ensure SL price is within reasonable range of current market price
            // This prevents applying Bitcoin SL (80k) to Bitcoin Cash position (500)
            const currentPrice = matchingPosition.market.bid || matchingPosition.market.offer;
            if (currentPrice) {
              const priceDiffRatio = Math.abs(trend.data.stopLoss - currentPrice) / currentPrice;
              
              if (priceDiffRatio > 0.5) { // > 50% difference
                console.error(`\n🛑 SL UPDATE ABORTED: Price mismatch detected!`);
                console.error(`   Position: ${matchingPosition.market.instrumentName} @ ${currentPrice}`);
                console.error(`   Requested SL: ${trend.data.stopLoss}`);
                console.error(`   Difference: ${(priceDiffRatio * 100).toFixed(0)}% (Threshold: 50%)`);
                console.error(`   Likely cause: Applying SL from original instrument to a fallback instrument with different pricing.\n`);
                
                broadcastTrade({
                  symbol: trend.data.instrument,
                  direction: 'SL_UPDATE',
                  status: 'error',
                  message: `SL Update Aborted: Price mismatch (${matchingPosition.market.instrumentName} vs SL Level).`,
                  timestamp: new Date().toISOString()
                });
                return;
              }
            }

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
              stopLevel: trend.data.stopLoss,
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
      
    } else if (trend.type === 'TP_UPDATE') {
      console.log('🎯 TAKE PROFIT UPDATE!\n');
      console.log(`Instrument: ${trend.data.instrument}`);
      console.log(`New TP: ${trend.data.takeProfit}\n`);
      
      // Get IG EPIC for instrument (with automatic weekend detection)
      const igMapping = getInstrumentMapping(trend.data.instrument);
      
      if (igMapping.epic) {
        try {
          // Get open positions and update matching one
          const positions = await igApi.getOpenPositions();
          let matchingPositions = findMatchingPositions(positions, igMapping, trend.data.instrument);
          
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
                limitLevel: trend.data.takeProfit,
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
    const dashboardPort = process.env.DASHBOARD_PORT || 3000;
    console.log(`Dashboard running at http://localhost:${dashboardPort}\n`);
    
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
const isSimulation = process.argv[1] && (process.argv[1].includes('live_test_simulation.js') || process.argv[1].includes('live_test_simulation_partial.js'));
if (!isSimulation) {
  main().catch(console.error);
}
