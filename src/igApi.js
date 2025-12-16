/**
 * IG Markets REST API Integration
 * Professional CFD Trading via IG's official REST API
 * 
 * Documentation: https://labs.ig.com/rest-trading-api-reference
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

class IGMarketsAPI {
  constructor() {
    // API endpoints
    this.baseUrl = process.env.IG_DEMO_MODE === 'true'
      ? 'https://demo-api.ig.com/gateway/deal'  // Demo API
      : 'https://api.ig.com/gateway/deal';       // Live API
    
    // Credentials
    this.apiKey = process.env.IG_API_KEY;
    this.username = process.env.IG_USERNAME;
    this.password = process.env.IG_PASSWORD;
    this.accountId = process.env.IG_ACCOUNT_ID;
    
    // Settings
    this.enabled = process.env.TRADING_ENABLED === 'true';
    this.demoMode = process.env.IG_DEMO_MODE === 'true';
    
    // Session tokens (will be set after login)
    this.cst = null;
    this.securityToken = null;
    
    // Auto-login on instantiation
    // if (this.enabled) {
    //   this.login().catch(err => {
    //     console.error('⚠️  Failed to auto-login to IG API:', err.message);
    //   });
    // }
  }

  /**
   * Authenticate with IG API and get session tokens
   * @returns {Promise<Object>} - Login result with CST and X-SECURITY-TOKEN
   */
  async login() {
    try {
      console.log('\n🔐 Logging in to IG API...');
      console.log(`Mode: ${this.demoMode ? 'DEMO' : 'LIVE'}`);
      console.log(`User: ${this.username}`);

      const response = await fetch(`${this.baseUrl}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'Version': '2'
        },
        body: JSON.stringify({
          identifier: this.username,
          password: this.password
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Login failed: ${error}`);
      }

      // Extract session tokens from headers
      this.cst = response.headers.get('CST');
      this.securityToken = response.headers.get('X-SECURITY-TOKEN');

      const data = await response.json();
      this.accountId = this.accountId || data.currentAccountId;

      console.log('✅ Login successful!');
      console.log(`Account ID: ${this.accountId}`);
      console.log(`CST Token: ${this.cst?.substring(0, 20)}...`);

      return {
        status: 'success',
        accountId: this.accountId,
        message: 'Logged in to IG API'
      };

    } catch (error) {
      console.error('❌ Login failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if currently logged in
   * @returns {boolean}
   */
  isLoggedIn() {
    return this.cst !== null && this.securityToken !== null;
  }

  /**
   * Check if session is valid, re-login if necessary
   * @returns {Promise<boolean>}
   */
  async ensureSession() {
    if (!this.cst || !this.securityToken) {
      console.log('⚠️  No active session, logging in...');
      await this.login();
      return true;
    }
    return true;
  }

  /**
   * Create a position directly (used by retry logic)
   * @param {string} epic - Instrument EPIC
   * @param {Object} params - Trade parameters
   * @returns {Promise<Object>} - Trade result
   */
  async createPosition(epic, params) {
    // Reuse executeTrade logic by constructing a signal object
    return this.executeTrade({
      epic: epic,
      symbol: params.symbol || epic,
      direction: params.direction,
      size: params.size,
      expiry: params.expiry,
      // Add other params if needed
    });
  }

  /**
   * Execute a trade via IG Markets REST API
   * @param {Object} signal - Trading signal from Telegram
   * @returns {Promise<Object>} - Trade execution result
   */
  async executeTrade(signal) {
    if (!this.enabled) {
      console.log('\n💤 Trading DISABLED - Signal would be executed:');
      console.log(JSON.stringify(signal, null, 2));
      return {
        status: 'disabled',
        message: 'TRADING_ENABLED is set to false'
      };
    }

    if (!this.apiKey || !this.username || !this.password) {
      throw new Error('IG API credentials missing in .env');
    }

    try {
      // Ensure we have a valid session
      await this.ensureSession();

      console.log('\n📡 Sending trade to IG Markets...');
      console.log(`Symbol: ${signal.symbol} (EPIC: ${signal.epic})`);
      console.log(`Direction: ${signal.direction}`);

      // Use signal.size if provided (from dashboard contract size), otherwise default to 1
      const calculatedSize = signal.size || 1;
      
      console.log(`\n💰 Position Size:`);
      console.log(`   Contract size: ${calculatedSize}`);

      // Fetch market details to get the correct currency
      const marketDetails = await this.getMarketDetails(signal.epic);
      const currencyCode = marketDetails ? marketDetails.currencyCode : (signal.currency || 'EUR');
      console.log(`   Currency: ${currencyCode}`);

      // Check if this is a Weekend market (they don't support MARKET orders)
      const isWeekendMarket = signal.epic.includes('.SUN') || 
                              signal.epic.includes('.WKND') ||
                              signal.epic.includes('.IGN') ||
                              signal.symbol.includes('Weekend');
      
      // For weekend markets, we must use LIMIT orders at current price
      const orderType = isWeekendMarket ? 'LIMIT' : 'MARKET';
      const level = isWeekendMarket ? (signal.direction === 'BUY' ? marketDetails.offer : marketDetails.bid) : undefined;
      
      if (isWeekendMarket) {
        console.log(`   ⚠️ Weekend market detected - using LIMIT order at ${level}`);
      }

      // Prepare order payload for IG API
      const orderPayload = {
        epic: signal.epic,                          // e.g., "IX.D.DAX.IFMM.IP"
        expiry: (signal.expiry === 'DFB' || !signal.expiry) ? '-' : signal.expiry,  // CFD = '-', not 'DFB'
        direction: signal.direction,                 // BUY or SELL
        size: calculatedSize,                        // Position size
        orderType: orderType,                        // MARKET or LIMIT
        level: level,                                // Price level for LIMIT orders
        timeInForce: 'FILL_OR_KILL',                // Execute immediately
        guaranteedStop: false,                       // Regular stop
        trailingStop: false,
        forceOpen: true,                             // Allow hedging
        currencyCode: currencyCode                   // Dynamic currency from market details
        // stopLevel/stopDistance REMOVED
      };

      console.log('\n📋 Order Details:');
      console.log(JSON.stringify(orderPayload, null, 2));

      // Send order to IG API
      const response = await fetch(`${this.baseUrl}/positions/otc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '2'
        },
        body: JSON.stringify(orderPayload)
      });

      const result = await response.json();
      
      // Debug: Log full response
      console.log('\n📥 IG API Response:');
      console.log('Status:', response.status);
      console.log('Result:', JSON.stringify(result, null, 2));

      if (response.ok && result.dealReference) {
        console.log('\n✅ TRADE EXECUTED SUCCESSFULLY!');
        console.log(`Deal Reference: ${result.dealReference}`);
        
        // Confirm the deal
        const confirmation = await this.confirmDeal(result.dealReference);
        
        console.log('\n🔍 Deal Confirmation:');
        console.log('Deal Status:', confirmation.dealStatus);
        console.log('Reason:', confirmation.reason || 'None');
        console.log('Full confirmation:', JSON.stringify(confirmation, null, 2));

        return {
          status: confirmation.dealStatus === 'ACCEPTED' ? 'success' : 'error',
          dealReference: result.dealReference,
          dealId: confirmation.dealId,
          dealStatus: confirmation.dealStatus,
          size: confirmation.size,
          level: confirmation.level,
          currency: currencyCode,
          direction: signal.direction,
          epic: signal.epic,
          reason: confirmation.reason,
          message: confirmation.dealStatus === 'ACCEPTED' 
            ? 'Trade executed via IG Markets API' 
            : `Trade rejected: ${confirmation.reason || 'UNKNOWN'} - Check IG platform for details`
        };

      } else {
        console.log('\n❌ Trade FAILED');
        console.log(`Error Code: ${result.errorCode || 'Unknown'}`);
        
        // Log ALL error details from IG
        console.log('\n🔍 Full IG Error Response:');
        console.log(JSON.stringify(result, null, 2));

        return {
          status: 'error',
          message: result.errorCode || 'Trade execution failed',
          error: result
        };
      }

    } catch (error) {
      console.error('\n❌ API Error:', error.message);
      return {
        status: 'error',
        message: error.message,
        error
      };
    }
  }

  /**
   * Confirm a deal after execution
   * @param {string} dealReference - Deal reference from execution
   * @returns {Promise<Object>} - Deal confirmation details
   */
  async confirmDeal(dealReference) {
    try {
      console.log(`\n🔍 Confirming deal ${dealReference}...`);

      // Retry loop for confirmation (max 10 attempts over 20 seconds)
      for (let i = 0; i < 10; i++) {
        const response = await fetch(`${this.baseUrl}/confirms/${dealReference}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json; charset=UTF-8',
            'X-IG-API-KEY': this.apiKey,
            'CST': this.cst,
            'X-SECURITY-TOKEN': this.securityToken,
            'Version': '1'
          }
        });

        const confirmation = await response.json();

        if (response.ok && confirmation.dealStatus === 'ACCEPTED') {
          console.log('✅ Deal confirmed!');
          console.log(`Deal ID: ${confirmation.dealId}`);
          console.log(`Level: ${confirmation.level}`);
          console.log(`Size: ${confirmation.size}`);
          console.log(`Profit/Loss: ${confirmation.profit} ${confirmation.profitCurrency}`);
          return confirmation;
        } 
        
        if (confirmation.dealStatus === 'REJECTED') {
          // Immediate return on rejection - no need to retry
          console.log('⚠️  Deal status: REJECTED');
          console.log('❌ Rejection reason:', confirmation.reason);
          console.log('Full response:', JSON.stringify(confirmation, null, 2));
          return confirmation;
        }
        
        if (confirmation.errorCode === 'error.confirms.deal-not-found') {
          console.log(`⏳ Deal not found yet, retrying (${i+1}/10)...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
          continue;
        }

        // Other status - wait and retry
        console.log(`⏳ Deal status: ${confirmation.dealStatus}, retrying (${i+1}/10)...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
      }
      
      console.log('❌ Confirmation timed out after 10 attempts (20 seconds)');
      return { dealStatus: 'UNKNOWN', reason: 'Confirmation timed out' };

    } catch (error) {
      console.error('Error confirming deal:', error.message);
      return { dealStatus: 'UNKNOWN', reason: error.message };
    }
  }

  /**
   * Close an open position
   * @param {string} dealId - Position deal ID to close
   * @param {string} epic - Instrument EPIC
   * @param {string} direction - Current direction (BUY/SELL)
   * @param {number} size - Position size
   * @param {string} [currency] - Optional currency code (avoids extra API call)
   * @returns {Promise<Object>} - Close result
   */
  async closePosition(dealId, epic, direction, size, currency = null) {
    try {
      await this.ensureSession();

      console.log(`\n🔒 Closing position ${dealId}...`);
      console.log(`Epic: ${epic}, Direction: ${direction}, Size: ${size}`);

      // FALLBACK STRATEGY:
      // 1. Try DELETE (Specific Close) first
      // 2. If 404/Error, try POST (Netting Close)

      // --- STRATEGY 1: DELETE ---
      const closePayload = {
        orderType: 'MARKET',
        size: size
      };

      console.log('\n📤 Closing via DELETE (specific Deal ID):');
      const response = await fetch(`${this.baseUrl}/positions/otc/${dealId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '1',
          '_method': 'DELETE'
        },
        body: JSON.stringify(closePayload)
      });

      if (response.ok) {
          const responseText = await response.text();
          const result = JSON.parse(responseText);
          console.log('✅ DELETE successful, confirming...');
          const confirmation = await this.confirmDeal(result.dealReference);
          return {
              status: confirmation.dealStatus === 'ACCEPTED' ? 'success' : 'error',
              dealReference: result.dealReference,
              dealId: confirmation.dealId,
              message: confirmation.dealStatus === 'ACCEPTED' ? 'Position closed' : `Close rejected: ${confirmation.reason}`,
              confirmation
          };
      }

      console.log(`⚠️ DELETE failed with status ${response.status}. Trying POST (Netting)...`);

      // --- STRATEGY 2: POST (Netting) ---
      const oppositeDirection = direction === 'BUY' ? 'SELL' : 'BUY';
      
      // Always fetch market details for Netting to ensure we have the correct instrument currency and expiry
      // The passed 'currency' might be the P&L currency (e.g. EUR) while the instrument is USD
      const marketDetails = await this.getMarketDetails(epic);
      const currencyCode = marketDetails ? marketDetails.currencyCode : (currency || 'EUR');
      const expiry = marketDetails?.rawData?.instrument?.expiry || '-';

      const nettingPayload = {
        epic: epic,
        expiry: expiry,
        direction: oppositeDirection,
        size: size,
        orderType: 'MARKET',
        timeInForce: 'FILL_OR_KILL',
        guaranteedStop: false,
        forceOpen: false, // Netting!
        currencyCode: currencyCode
      };

      console.log('\n📤 Closing via POST (Netting):');
      console.log(JSON.stringify(nettingPayload, null, 2));

      const postResponse = await fetch(`${this.baseUrl}/positions/otc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '2'
        },
        body: JSON.stringify(nettingPayload)
      });

      const postText = await postResponse.text();
      let postResult;
      try {
        postResult = JSON.parse(postText);
      } catch (e) {
        postResult = { error: postText };
      }

      if (postResponse.ok && postResult.dealReference) {
        console.log('✅ Netting order submitted');
        const confirmation = await this.confirmDeal(postResult.dealReference);
        return {
          status: confirmation.dealStatus === 'ACCEPTED' ? 'success' : 'error',
          dealReference: postResult.dealReference,
          dealId: confirmation.dealId,
          message: confirmation.dealStatus === 'ACCEPTED' ? 'Position closed (Netting)' : `Close rejected: ${confirmation.reason}`,
          confirmation
        };
      } else {
        console.log('❌ Failed to close position via Netting');
        return {
          status: 'error',
          message: postResult.errorCode || 'Failed to close position',
          error: postResult
        };
      }

    } catch (error) {
      console.error('Error closing position:', error.message);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Update stop loss for an open position with auto-scaling
   * @param {string} dealId - Position deal ID
   * @param {number} newStopLevel - New stop loss level
   * @returns {Promise<Object>} - Update result
   */
  async updateStopLoss(dealId, newStopLevel) {
    try {
      await this.ensureSession();
      
      let currentStopLevel = newStopLevel;
      
      // 1. Get current position to validate and scale
      try {
          const positions = await this.getOpenPositions();
          const position = positions.find(p => p.position.dealId === dealId);
          
          if (position) {
              const marketPrice = position.market.bid; // Use bid as reference
              const ratio = marketPrice / currentStopLevel;
              
              console.log(`\n🔍 Checking SL Scaling for ${dealId}:`);
              console.log(`   Market: ${marketPrice}, Requested SL: ${currentStopLevel}, Ratio: ${ratio.toFixed(2)}`);
              
              // Log min stop distance
              // Note: dealingRules might be nested differently in position object
              // position.market is usually the market snapshot
              // We might need to fetch full details if we want dealing rules
              
              // Auto-scale if needed
              if (ratio > 80 && ratio < 120) {
                  console.log('   💡 Detected ~100x scaling difference. Adjusting SL...');
                  currentStopLevel = currentStopLevel * 100;
              } else if (ratio > 8 && ratio < 12) {
                  console.log('   💡 Detected ~10x scaling difference. Adjusting SL...');
                  currentStopLevel = currentStopLevel * 10;
              } else if (ratio > 0.008 && ratio < 0.012) {
                  console.log('   💡 Detected ~0.01x scaling difference. Adjusting SL...');
                  currentStopLevel = currentStopLevel / 100;
              }
              
              // Validate direction
              const direction = position.position.direction;
              const currentOffer = position.market.offer;
              const currentBid = position.market.bid;
              
              if (direction === 'BUY' && currentStopLevel >= currentBid) {
                 console.warn(`   ⚠️ SL ${currentStopLevel} is >= Bid ${currentBid} for BUY. This might fail.`);
              } else if (direction === 'SELL' && currentStopLevel <= currentOffer) {
                 console.warn(`   ⚠️ SL ${currentStopLevel} is <= Offer ${currentOffer} for SELL. This might fail.`);
              }
          } else {
              console.warn(`   ⚠️ Position ${dealId} not found. Proceeding with unscaled SL.`);
          }
      } catch (e) {
          console.warn(`   ⚠️ Could not fetch position for scaling check: ${e.message}`);
      }

      console.log(`\n🛑 Updating SL for deal ${dealId} to ${currentStopLevel}...`);

      const updatePayload = {
        stopLevel: currentStopLevel,
        guaranteedStop: false
      };

      const response = await fetch(`${this.baseUrl}/positions/otc/${dealId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '2'
        },
        body: JSON.stringify(updatePayload)
      });

      const result = await response.json();

      if (response.ok && result.dealReference) {
        console.log('✅ Stop Loss updated successfully');
        return {
          status: 'success',
          dealReference: result.dealReference,
          message: 'Stop Loss updated'
        };
      } else {
        console.log('❌ Failed to update Stop Loss');
        console.log('   Error Code:', result.errorCode);
        return {
          status: 'error',
          message: result.errorCode || 'Failed to update SL',
          error: result
        };
      }

    } catch (error) {
      console.error('Error updating SL:', error.message);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Update take profit for an open position
   * @param {string} dealId - Position deal ID
   * @param {number} newTakeProfitLevel - New take profit level
   * @returns {Promise<Object>} - Update result
   */
  async updateTakeProfit(dealId, newTakeProfitLevel) {
    try {
      await this.ensureSession();

      console.log(`\n🎯 Updating TP for deal ${dealId} to ${newTakeProfitLevel}...`);

      const updatePayload = {
        limitLevel: newTakeProfitLevel
      };

      const response = await fetch(`${this.baseUrl}/positions/otc/${dealId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '2'
        },
        body: JSON.stringify(updatePayload)
      });

      const result = await response.json();

      if (response.ok && result.dealReference) {
        console.log('✅ Take Profit updated successfully');
        const confirmation = await this.confirmDeal(result.dealReference);
        return {
          success: true,
          dealReference: result.dealReference,
          confirmation,
          message: 'Take Profit updated'
        };
      } else {
        console.log('❌ Failed to update Take Profit');
        return {
          success: false,
          error: result.errorCode || 'Failed to update TP'
        };
      }
    } catch (error) {
      console.error('Error updating TP:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update both Stop Loss and Take Profit for a position
   * @param {string} dealId - The deal ID of the position
   * @param {object} params - { stopLevel, limitLevel }
   * @returns {Promise<object>} - Result of the update
   */
  async updatePosition(dealId, { stopLevel, limitLevel }) {
    try {
      await this.ensureSession();

      console.log(`\n🔄 Updating Position ${dealId}...`);
      console.log(`   New SL: ${stopLevel}`);
      console.log(`   New TP: ${limitLevel}`);

      const updatePayload = {
        stopLevel: stopLevel,
        limitLevel: limitLevel,
        guaranteedStop: false
      };

      const response = await fetch(`${this.baseUrl}/positions/otc/${dealId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '2',
          '_method': 'PUT'
        },
        body: JSON.stringify(updatePayload)
      });

      const result = await response.json();

      if (response.ok && result.dealReference) {
        console.log('✅ Position updated successfully');
        const confirmation = await this.confirmDeal(result.dealReference);
        return {
          success: true,
          dealReference: result.dealReference,
          confirmation,
          message: 'Position updated'
        };
      } else {
        console.log('❌ Failed to update Position');
        console.log('Error details:', JSON.stringify(result, null, 2));
        return {
          success: false,
          error: result.errorCode || 'Failed to update Position'
        };
      }
    } catch (error) {
      console.error('Error updating Position:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate position size based on fixed risk amount
   * @param {string} epic - IG EPIC code
   * @param {number} entryPrice - Entry price level
   * @param {number} stopLoss - Stop loss level
   * @param {number} riskPercent - Risk percentage (ignored, using fixed €50)
   * @returns {Promise<number>} - Position size
   */
  async calculatePositionSize(epic, entryPrice, stopLoss, riskPercent = 1) {
    try {
      // Fixed risk amount per trade
      const riskAmount = parseFloat(process.env.FIXED_RISK_AMOUNT || 50);

      // Calculate risk per point
      const riskPerPoint = Math.abs(entryPrice - stopLoss);
      
      console.log(`\n💰 Risk Management:`);
      console.log(`   Fixed Risk: €${riskAmount.toFixed(2)} per trade`);
      console.log(`   Entry: ${entryPrice}, SL: ${stopLoss}`);
      console.log(`   Risk per point: ${riskPerPoint.toFixed(2)}`);
      
      // Calculate position size
      let size = 1; // Default minimum
      
      if (riskPerPoint > 0) {
        size = Math.floor(riskAmount / riskPerPoint);
        size = Math.max(1, Math.min(size, 100)); // Between 1 and 100
      }

      console.log(`   Position size: ${size}`);

      return size;

    } catch (error) {
      console.error('Error calculating position size:', error.message);
      return 1; // Default minimum
    }
  }

  /**
   * Get account information
   * @returns {Promise<Object>} - Account details
   */
  async getAccountInfo() {
    try {
      await this.ensureSession();

      const response = await fetch(`${this.baseUrl}/accounts`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '1'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const account = data.accounts.find(acc => acc.accountId === this.accountId);
        
        return {
          accountId: account.accountId,
          accountName: account.accountName,
          balance: account.balance.balance,
          available: account.balance.available,
          deposit: account.balance.deposit,
          profitLoss: account.balance.profitLoss,
          currency: account.currency
        };
      } else {
        console.warn('Could not fetch account info');
        return { balance: 10000 }; // Demo default
      }

    } catch (error) {
      console.warn('Could not fetch account info:', error.message);
      return { balance: 10000 }; // Demo default
    }
  }

  /**
   * Get all open positions
   * @returns {Promise<Array>} - List of open positions
   */
  async getOpenPositions() {
    try {
      await this.ensureSession();

      const response = await fetch(`${this.baseUrl}/positions`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '2'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.positions || [];
      } else {
        console.error('Failed to fetch positions:', response.status);
        return [];
      }

    } catch (error) {
      console.error('Error fetching positions:', error.message);
      return [];
    }
  }


  /**
   * Search for markets by keyword
   * @param {string} searchTerm - Search term (e.g., "Tesla", "Netflix")
   * @returns {Promise<Array>} - List of matching markets
   */
  async searchMarkets(searchTerm) {
    try {
      await this.ensureSession();

      const response = await fetch(`${this.baseUrl}/markets?searchTerm=${encodeURIComponent(searchTerm)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '1'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.markets || [];
      } else {
        console.warn('Market search failed, status:', response.status);
        return [];
      }

    } catch (error) {
      console.error('Error searching markets:', error.message);
      return [];
    }
  }

  /**
   * Get historical prices
   * @param {string} epic - IG EPIC code
   * @param {string} resolution - Resolution (e.g., 'MINUTE', 'HOUR', 'DAY')
   * @param {number} numPoints - Number of data points
   * @returns {Promise<Array>} - List of price points
   */
  async getPrices(epic, resolution = 'HOUR', numPoints = 10) {
    try {
      await this.ensureSession();

      const response = await fetch(`${this.baseUrl}/prices/${epic}?resolution=${resolution}&max=${numPoints}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '3'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.prices || [];
      } else {
        try {
          const errorData = await response.json();
          // Suppress log spam for unauthorized equity access
          if (errorData.errorCode !== 'unauthorised.access.to.equity.exception') {
             // console.warn(`Could not fetch prices for ${epic}. Status: ${response.status}, Code: ${errorData.errorCode}`);
          }
        } catch (e) {
          // console.warn(`Could not fetch prices for ${epic}. Status: ${response.status}`);
        }
        return [];
      }

    } catch (error) {
      console.error('Error fetching prices:', error.message);
      return [];
    }
  }

  /**
   * Get market details (for EPIC validation)
   * @param {string} epic - IG EPIC code
   * @returns {Promise<Object>} - Market details
   */
  async getMarketDetails(epic) {
    try {
      await this.ensureSession();

      const response = await fetch(`${this.baseUrl}/markets/${epic}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '3'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Safely extract currency
        const currencyCode = data.instrument?.currencies?.[0]?.code || 'EUR';
        
        // DEBUG: Log dealing rules to find increment
        if (epic.includes('DAX') || epic.includes('Germany') || epic.includes('IX.')) {
           console.log(`🔍 DEBUG DEALING RULES for ${epic}:`, JSON.stringify(data.dealingRules, null, 2));
        }
        
        // Determine deal size increment
        // For stocks (SHARES type or UD./UA./UB. prefix), increment is typically 1.0
        // For CFDs and indices, use minDealSize as increment
        let dealSizeIncrement = data.dealingRules?.minDealSize?.value || 0.1;
        if (data.instrument?.type === 'SHARES' || epic.startsWith('UD.') || epic.startsWith('UA.') || epic.startsWith('UB.')) {
          dealSizeIncrement = 1.0; // Stocks must be whole numbers
        } else if (epic.startsWith('IX.')) {
          // Indices often have specific increments (0.5 for DAX, 1.0 for others)
          dealSizeIncrement = data.dealingRules?.minDealSize?.value || 0.5;
        }
        
        // Extract price - try multiple fields in priority order
        // Add more fallback fields and handle undefined snapshot
        const snapshot = data.snapshot || {};
        
        // DEBUG: Log snapshot for problematic instruments
        if (epic.includes('NVDA') || epic.includes('NVIDIA')) {
             console.log(`🔍 DEBUG SNAPSHOT for ${epic}:`, JSON.stringify(snapshot, null, 2));
        }

        let bid = snapshot.bid;
        let offer = snapshot.offer;
        
        // SANITY CHECK: If bid/offer are suspiciously low compared to high/low/close, use those instead
        // This fixes the issue where IG returns "Net Change" (e.g. 6.15) instead of Price (e.g. 178)
        // Note: IG API v3 snapshot uses 'high'/'low', but some endpoints might use 'highPrice'/'lowPrice'
        const referencePrice = snapshot.high || snapshot.low || snapshot.highPrice || snapshot.lowPrice || snapshot.closePrice;
        
        if (referencePrice) {
            // If bid is missing OR (bid exists AND is < 10% of reference price), use reference
            if (!bid || (bid < referencePrice * 0.1)) {
                if (bid) console.warn(`⚠️ Suspicious BID price (${bid}) detected! Far below reference (${referencePrice}). Using reference.`);
                bid = referencePrice;
            }
            
            // Same for offer
            if (!offer || (offer < referencePrice * 0.1)) {
                if (offer) console.warn(`⚠️ Suspicious OFFER price (${offer}) detected! Far below reference (${referencePrice}). Using reference.`);
                offer = referencePrice;
            }
        }
        
        // Final fallback if still undefined
        bid = bid || snapshot.closePrice || snapshot.high || snapshot.low || snapshot.highPrice || snapshot.lowPrice;
        offer = offer || snapshot.closePrice || snapshot.high || snapshot.low || snapshot.highPrice || snapshot.lowPrice;
        
        // console.log(`🔍 Price extraction for ${data.instrument?.name}: bid=${bid}, offer=${offer}, closePrice=${snapshot.closePrice}, high=${snapshot.highPrice}, low=${snapshot.lowPrice}`);
        
        return {
          epic: data.instrument?.epic,
          name: data.instrument?.name,
          type: data.instrument?.type,
          marketStatus: snapshot.marketStatus,
          bid: bid,
          offer: offer,
          closePrice: snapshot.closePrice,
          highPrice: snapshot.highPrice,
          lowPrice: snapshot.lowPrice,
          updateTime: snapshot.updateTime,
          minDealSize: data.dealingRules?.minDealSize?.value,
          maxDealSize: data.dealingRules?.maxDealSize?.value,
          dealSizeIncrement: dealSizeIncrement,
          currencyCode: currencyCode,
          marginFactor: data.instrument?.marginFactor,  // Add margin percentage
          marginDepositBands: data.instrument?.marginDepositBands,  // Add margin bands
          snapshot: snapshot,  // Keep snapshot for debugging
          rawData: data  // Keep full response for debugging
        };
      } else {
        // Suppress log spam for unauthorized equity access
        if (response.status !== 403) {
            console.warn('Could not fetch market details, status:', response.status);
        }
        return null;
      }

    } catch (error) {
      console.error('Error fetching market details:', error.message);
      return null;
    }
  }

  /**
   * Searches for a market by term and returns the best matching EPIC
   * @param {string} searchTerm - The name or symbol to search for (e.g. "Amazon", "NVDA")
   * @returns {Promise<string|null>} - The best matching EPIC or null
   */
  async searchMarket(searchTerm) {
    try {
      await this.ensureSession();
      console.log(`    🔎 Searching IG Markets for: "${searchTerm}"...`);
      
      const response = await fetch(`${this.baseUrl}/markets?searchTerm=${encodeURIComponent(searchTerm)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '1'
        }
      });

      if (!response.ok) {
        console.log(`    ❌ Search failed with status: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (!data.markets || data.markets.length === 0) {
        console.log(`    ❌ No markets found for search term: "${searchTerm}"`);
        return null;
      }

      // Filter for likely candidates (Cash markets, US stocks)
      const markets = data.markets;
      
      // 1. Try to find exact match for "Cash" or "Kassa" (Stocks)
      let bestMatch = markets.find(m => 
        m.instrumentType === 'SHARES' && 
        (m.epic.includes('CASH') || m.epic.includes('KASSA'))
      );
      
      // 2. Fallback to any Share
      if (!bestMatch) {
        bestMatch = markets.find(m => m.instrumentType === 'SHARES');
      }
      
      // 3. Fallback to first result
      if (!bestMatch) {
        bestMatch = markets[0];
      }

      console.log(`    ✅ Found best match: ${bestMatch.instrumentName} (${bestMatch.epic})`);
      return bestMatch.epic;

    } catch (error) {
      console.error(`    ❌ Search failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Get account activity (for detecting automatic position closes)
   * @param {Object} params - Query parameters
   * @param {string} params.from - Start date YYYY-MM-DD (default: 24h ago)
   * @param {string} params.to - End date YYYY-MM-DD (default: today)
   * @param {boolean} params.detailed - Detailed response (default: true)
   * @param {number} params.pageSize - Page size (default: 50)
   * @returns {Promise<Object>} - Account activity data
   */
  async getAccountActivity({ from, to, detailed = true, pageSize = 50 } = {}) {
    try {
      await this.ensureSession();

      // Default 'from' to 24h ago if not provided
      if (!from) {
          from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      
      let url = `${this.baseUrl}/history/activity?from=${from}`;
      if (to) url += `&to=${to}`;
      if (detailed) url += `&detailed=true`;
      if (pageSize) url += `&pageSize=${pageSize}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '3'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        console.warn('Could not fetch account activity, status:', response.status);
        return { activities: [] };
      }

    } catch (error) {
      console.error('Error fetching account activity:', error.message);
      return { activities: [] };
    }
  }

  /**
   * Get transaction history
   * @param {Object} params - Query parameters
   * @param {string} params.from - Start date YYYY-MM-DD (default: 30 days ago)
   * @param {string} params.to - End date YYYY-MM-DD (default: today)
   * @param {number} params.pageSize - Page size (default: 50)
   * @returns {Promise<Array>} - List of transactions
   */
  async getTransactionHistory({ from, to, pageSize = 50 } = {}) {
    try {
      await this.ensureSession();

      // Default 'from' to 30 days ago if not provided
      if (!from) {
          from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      let url = `${this.baseUrl}/history/transactions?from=${from}&type=ALL`;
      if (to) url += `&to=${to}`;
      if (pageSize) url += `&pageSize=${pageSize}`;

      // Try Version 2 first (standard)
      let response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '2'
        }
      });

      // If 403 or error, try Version 1
      if (!response.ok) {
          console.warn(`Transaction History V2 failed (${response.status}), trying V1...`);
          response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/json; charset=UTF-8',
              'X-IG-API-KEY': this.apiKey,
              'CST': this.cst,
              'X-SECURITY-TOKEN': this.securityToken,
              'Version': '1'
            }
          });
      }

      if (response.ok) {
        const data = await response.json();
        return data.transactions || [];
      } else {
        console.warn('Could not fetch transaction history, status:', response.status);
        return [];
      }

    } catch (error) {
      console.error('Error fetching transaction history:', error.message);
      return [];
    }
  }
}

export const igApi = new IGMarketsAPI();

// Export specific functions for standalone use
export const igLogin = () => igApi.login();
export const getMarketDetails = (epic) => igApi.getMarketDetails(epic);
