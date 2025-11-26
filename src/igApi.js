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
    if (this.enabled) {
      this.login().catch(err => {
        console.error('⚠️  Failed to auto-login to IG API:', err.message);
      });
    }
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

      // Calculate position size based on fixed risk
      const fixedRisk = parseFloat(process.env.FIXED_RISK_AMOUNT || 50);
      
      // Simple position size: 1 contract for now
      // Can be enhanced later with proper risk calculation
      const calculatedSize = 1;
      
      console.log(`\n💰 Risk Management:`);
      console.log(`   Fixed Risk: €${fixedRisk.toFixed(2)} per trade`);
      console.log(`   Position size: ${calculatedSize}`);

      // Fetch market details to get the correct currency
      const marketDetails = await this.getMarketDetails(signal.epic);
      const currencyCode = marketDetails ? marketDetails.currencyCode : 'EUR';
      console.log(`   Currency: ${currencyCode}`);

      // Prepare order payload for IG API
      const orderPayload = {
        epic: signal.epic,                          // e.g., "IX.D.DAX.IFMM.IP"
        expiry: signal.expiry === 'DFB' ? '-' : signal.expiry,  // CFD = '-', not 'DFB'
        direction: signal.direction,                 // BUY or SELL
        size: calculatedSize,                        // Position size
        orderType: 'MARKET',                         // Market order
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
            : `Trade rejected: ${confirmation.reason}`
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

      // Retry loop for confirmation (max 3 attempts)
      for (let i = 0; i < 3; i++) {
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
        
        if (confirmation.errorCode === 'error.confirms.deal-not-found') {
          console.log(`⏳ Deal not found yet, retrying (${i+1}/3)...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
          continue;
        }

        // If rejected or other error, return immediately
        console.log('⚠️  Deal status:', confirmation.dealStatus);
        if (confirmation.reason) {
          console.log('❌ Rejection reason:', confirmation.reason);
        }
        console.log('Full response:', JSON.stringify(confirmation, null, 2));
        return confirmation;
      }
      
      return { dealStatus: 'UNKNOWN', reason: 'Confirmation timed out' };

    } catch (error) {
      console.error('Error confirming deal:', error.message);
      return { dealStatus: 'UNKNOWN' };
    }
  }

  /**
   * Close an open position
   * @param {string} dealId - Position deal ID to close
   * @returns {Promise<Object>} - Close result
   */
  async closePosition(dealId, epic, direction, size) {
    try {
      await this.ensureSession();

      console.log(`\n🔒 Closing position ${dealId}...`);
      console.log(`Epic: ${epic}, Direction: ${direction}, Size: ${size}`);

      // To close a position, we place an opposite market order
      const oppositeDirection = direction === 'BUY' ? 'SELL' : 'BUY';

      // Fetch market details to get the correct currency
      const marketDetails = await this.getMarketDetails(epic);
      const currencyCode = marketDetails ? marketDetails.currencyCode : 'EUR';

      // IG API: Close by opening opposite position (POST, not DELETE)
      const closePayload = {
        epic: epic,
        expiry: '-',  // Use '-' for DFB (Daily Funded Bet)
        direction: oppositeDirection,
        size: size,
        orderType: 'MARKET',
        timeInForce: 'FILL_OR_KILL',
        guaranteedStop: false,
        forceOpen: false,  // Important: false to close existing position
        currencyCode: currencyCode
      };

      console.log('\n📤 Closing via opposite market order (POST):');
      console.log(JSON.stringify(closePayload, null, 2));

      const response = await fetch(`${this.baseUrl}/positions/otc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '2'
        },
        body: JSON.stringify(closePayload)
      });

      const responseText = await response.text();
      console.log('\n📥 Response status:', response.status);
      console.log('Response body:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { error: responseText };
      }

      if (response.ok && result.dealReference) {
        console.log('✅ Position close order submitted');
        const confirmation = await this.confirmDeal(result.dealReference);
        
        return {
          status: confirmation.dealStatus === 'ACCEPTED' ? 'success' : 'error',
          dealReference: result.dealReference,
          dealId: confirmation.dealId,
          message: confirmation.dealStatus === 'ACCEPTED' ? 'Position closed' : `Close rejected: ${confirmation.reason}`,
          confirmation
        };
      } else {
        console.log('❌ Failed to close position');
        return {
          status: 'error',
          message: result.errorCode || 'Failed to close position',
          error: result
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
   * Update stop loss for an open position
   * @param {string} dealId - Position deal ID
   * @param {number} newStopLevel - New stop loss level
   * @returns {Promise<Object>} - Update result
   */
  async updateStopLoss(dealId, newStopLevel) {
    try {
      await this.ensureSession();

      console.log(`\n🛑 Updating SL for deal ${dealId} to ${newStopLevel}...`);

      const updatePayload = {
        stopLevel: newStopLevel,
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
   * Update stop loss on open position
   * @param {string} dealId - Deal ID of position
   * @param {number} stopLevel - New stop loss level
   * @returns {Promise<Object>} - Update result
   */
  async updateStopLoss(dealId, stopLevel) {
    try {
      console.log(`\n📤 Updating SL for ${dealId}...`);
      console.log(`New SL: ${stopLevel}\n`);

      await this.ensureSession();

      // First, get the current position details
      const positions = await this.getOpenPositions();
      const position = positions.find(p => p.position.dealId === dealId);
      
      if (!position) {
        console.error('❌ Position not found!');
        return {
          status: 'error',
          message: 'Position not found'
        };
      }

      // Validate SL level against position direction and current price
      const direction = position.position.direction;
      const currentPrice = position.position.level;
      const currentMarketBid = position.market.bid;
      const currentMarketOffer = position.market.offer;
      
      console.log(`📊 Position validation:`);
      console.log(`   Direction: ${direction}`);
      console.log(`   Open Level: ${currentPrice}`);
      console.log(`   Current Market: Bid ${currentMarketBid} / Offer ${currentMarketOffer}`);
      console.log(`   Requested SL: ${stopLevel}`);
      
      // Validate SL based on direction
      let isValid = true;
      let validationMessage = '';
      
      if (direction === 'BUY') {
        // For BUY (long), SL must be BELOW current price
        if (stopLevel >= currentMarketBid) {
          isValid = false;
          validationMessage = `SL ${stopLevel} must be below current bid ${currentMarketBid} for BUY position`;
        }
      } else if (direction === 'SELL') {
        // For SELL (short), SL must be ABOVE current price
        if (stopLevel <= currentMarketOffer) {
          isValid = false;
          validationMessage = `SL ${stopLevel} must be above current offer ${currentMarketOffer} for SELL position`;
        }
      }
      
      if (!isValid) {
        console.error(`❌ Invalid SL level: ${validationMessage}`);
        return {
          status: 'error',
          message: `INVALID_SL_LEVEL: ${validationMessage}`,
          validation: {
            direction,
            currentPrice,
            requestedSL: stopLevel,
            reason: validationMessage
          }
        };
      }
      
      console.log(`✅ SL level validated successfully`);

      const payload = {
        stopLevel,
        limitLevel: position.position.limitLevel // Keep existing TP
      };

      console.log('Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.baseUrl}/positions/otc/${dealId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json; charset=UTF-8',
          'X-IG-API-KEY': this.apiKey,
          'CST': this.cst,
          'X-SECURITY-TOKEN': this.securityToken,
          'Version': '2'
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      console.log('Response status:', response.status);
      console.log('Response body:', responseText);

      if (response.ok) {
        const data = JSON.parse(responseText);
        
        // Confirm the update
        if (data.dealReference) {
          const confirmation = await this.confirmDeal(data.dealReference);
          if (confirmation.dealStatus === 'ACCEPTED') {
            console.log('✅ SL updated and confirmed!');
            return {
              status: 'success',
              dealReference: data.dealReference,
              confirmation,
              message: 'Stop loss updated successfully'
            };
          }
        }
        
        return {
          status: 'success',
          dealReference: data.dealReference,
          message: 'Stop loss update submitted'
        };
      } else {
        const error = JSON.parse(responseText);
        console.error('❌ SL update failed:', error.errorCode);
        return {
          status: 'error',
          message: error.errorCode || 'SL update failed'
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
        
        return {
          epic: data.instrument?.epic,
          name: data.instrument?.name,
          type: data.instrument?.type,
          marketStatus: data.snapshot?.marketStatus,
          bid: data.snapshot?.bid,
          offer: data.snapshot?.offer,
          minDealSize: data.dealingRules?.minDealSize?.value,
          maxDealSize: data.dealingRules?.maxDealSize?.value,
          currencyCode: currencyCode
        };
      } else {
        console.warn('Could not fetch market details, status:', response.status);
        return null;
      }

    } catch (error) {
      console.error('Error fetching market details:', error.message);
      return null;
    }
  }
}

export const igApi = new IGMarketsAPI();
