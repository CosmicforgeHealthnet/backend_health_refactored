// src/services/currencyService.js
const axios = require('axios');

class CurrencyService {
  constructor() {
    // Paystack supported currencies
    this.paystackCurrencies = [
      'NGN', 'USD', 'GHS', 'ZAR', 'KES', 'XOF', 'EGP', 'XAF'
    ];
    
    // Flutterwave supported currencies  
    this.flutterwaveCurrencies = [
      'NGN', 'USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS', 'ZAR', 
      'XOF', 'XAF', 'GHS', 'SLL', 'MWK', 'ZMW', 'RWF', 'CAD', 'AUD'
    ];
    
    // Combined supported currencies
    this.supportedCurrencies = [...new Set([
      ...this.paystackCurrencies,
      ...this.flutterwaveCurrencies
    ])];
    
    // Cache for API calls
    this.countryCache = new Map();
    this.rateCache = new Map();
    this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Get currency code for a country using REST Countries API
   * @param {string} countryName - Name of the country
   * @returns {Promise<string>} - Currency code (e.g., 'NGN')
   */
  async getCountryCurrency(countryName) {
    if (!countryName) return 'USD';
    try {
      // Check cache first
      const cacheKey = countryName.toLowerCase();
      const cached = this.countryCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.currency;
      }

      // Fetch from REST Countries API
      const response = await axios.get(
        `https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}`,
        { timeout: 5000 }
      );

      if (response.data && response.data.length > 0) {
        const country = response.data[0];
        
        // Extract currency (v3.1 stores currencies as object)
        const currencies = country.currencies;
        if (currencies) {
          const currencyCode = Object.keys(currencies)[0]; // Get first currency
          
          // Cache the result
          this.countryCache.set(cacheKey, {
            currency: currencyCode,
            timestamp: Date.now()
          });
          
          return currencyCode;
        }
      }
      
      throw new Error('Currency not found for country');
      
    } catch (error) {
      console.warn(`🚨 Could not get currency for ${countryName}:`, error.message);
      return 'USD'; // Default fallback
    }
  }

  /**
   * Get exchange rate between two currencies
   * @param {string} fromCurrency - Source currency (e.g., 'USD')
   * @param {string} toCurrency - Target currency (e.g., 'NGN')
   * @returns {Promise<number>} - Exchange rate
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    try {
      // Same currency, no conversion needed
      if (fromCurrency === toCurrency) {
        return 1;
      }

      // Check cache
      const cacheKey = `${fromCurrency}_${toCurrency}`;
      const cached = this.rateCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.rate;
      }

      // Use Fawaz's free currency API (no rate limits)
      const response = await axios.get(
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${fromCurrency.toLowerCase()}.json`,
        { timeout: 5000 }
      );

      if (response.data && response.data[fromCurrency.toLowerCase()]) {
        const rates = response.data[fromCurrency.toLowerCase()];
        const rate = rates[toCurrency.toLowerCase()];
        
        if (rate) {
          // Cache the result
          this.rateCache.set(cacheKey, {
            rate: rate,
            timestamp: Date.now()
          });
          
          return rate;
        }
      }

      throw new Error('Exchange rate not found');
      
    } catch (error) {
      console.warn(`🚨 Could not get exchange rate ${fromCurrency} -> ${toCurrency}:`, error.message);
      
      // Fallback to ExchangeRate-API (backup option)
      try {
        const fallbackResponse = await axios.get(
          `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`,
          { timeout: 5000 }
        );
        
        const rate = fallbackResponse.data.rates[toCurrency];
        if (rate) {
          this.rateCache.set(`${fromCurrency}_${toCurrency}`, {
            rate: rate,
            timestamp: Date.now()
          });
          return rate;
        }
      } catch (fallbackError) {
        console.warn('🚨 Fallback exchange API also failed:', fallbackError.message);
      }
      
      return 1; // Ultimate fallback
    }
  }

  /**
   * Convert currency amount based on user's country
   * @param {Object} params - Conversion parameters
   * @param {number} params.amount - Amount to convert
   * @param {string} params.fromCurrency - Source currency
   * @param {string} params.userCountry - User's country name
   * @param {string} [params.toCurrency] - Optional target currency (overrides country detection)
   * @returns {Promise<Object>} - Conversion result
   */
  async convertCurrency({ amount, fromCurrency, userCountry, toCurrency = null }) {
    try {
      // Step 1: Determine target currency
      let targetCurrency = toCurrency;
      
      if (!targetCurrency) {
        targetCurrency = userCountry ? await this.getCountryCurrency(userCountry) : 'USD';
      }

      // Step 2: Check if target currency is supported by payment gateways
      if (!this.supportedCurrencies.includes(targetCurrency)) {
        console.warn(`🚨 Currency ${targetCurrency} not supported by Paystack/Flutterwave. Defaulting to USD.`);
        targetCurrency = 'USD';
      }

      // Step 3: Get exchange rate and convert
      const exchangeRate = await this.getExchangeRate(fromCurrency, targetCurrency);
      const convertedAmount = Math.round((amount * exchangeRate) * 100) / 100; // Round to 2 decimal places

      return {
        success: true,
        originalAmount: amount,
        originalCurrency: fromCurrency,
        convertedAmount,
        convertedCurrency: targetCurrency,
        exchangeRate,
        userCountry,
        isSupported: this.supportedCurrencies.includes(targetCurrency),
        supportedByPaystack: this.paystackCurrencies.includes(targetCurrency),
        supportedByFlutterwave: this.flutterwaveCurrencies.includes(targetCurrency),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('🚨 Currency conversion failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        originalAmount: amount,
        originalCurrency: fromCurrency,
        convertedAmount: amount, // Fallback to original amount
        convertedCurrency: fromCurrency, // Keep original currency
        exchangeRate: 1,
        userCountry,
        isSupported: this.supportedCurrencies.includes(fromCurrency),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get list of supported currencies with details
   * @returns {Object} - Currency information
   */
  getSupportedCurrencies() {
    return {
      paystack: this.paystackCurrencies,
      flutterwave: this.flutterwaveCurrencies,
      combined: this.supportedCurrencies,
      total: this.supportedCurrencies.length
    };
  }

  /**
   * Validate currency code
   * @param {string} currencyCode - Currency to validate
   * @returns {boolean} - Is currency supported
   */
  isCurrencySupported(currencyCode) {
    return this.supportedCurrencies.includes(currencyCode.toUpperCase());
  }

  /**
   * Get payment gateway support for currency
   * @param {string} currencyCode - Currency to check
   * @returns {Object} - Support information
   */
  getPaymentGatewaySupport(currencyCode) {
    const currency = currencyCode.toUpperCase();
    return {
      currency,
      paystack: this.paystackCurrencies.includes(currency),
      flutterwave: this.flutterwaveCurrencies.includes(currency),
      anyGateway: this.supportedCurrencies.includes(currency)
    };
  }
}

module.exports = CurrencyService;
