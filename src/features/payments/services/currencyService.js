// src/services/currencyService.js
const cache = require('../../../shared/utils/cache');

class CurrencyService {

  // Fallback currencies (used if API calls fail)
  static FALLBACK_PAYSTACK_CURRENCIES = ['NGN', 'USD', 'GHS', 'ZAR', 'KES'];
  static FALLBACK_FLUTTERWAVE_CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS', 'ZAR', 'XAF', 'XOF', 'RWF', 'ZMW'];

  // Country to currency mapping
  static COUNTRY_CURRENCY_MAP = {
    // Africa - Paystack/Flutterwave supported
    NG: 'NGN', // Nigeria
    GH: 'GHS', // Ghana
    ZA: 'ZAR', // South Africa
    KE: 'KES', // Kenya
    UG: 'UGX', // Uganda
    TZ: 'TZS', // Tanzania
    RW: 'RWF', // Rwanda
    ZM: 'ZMW', // Zambia

    // Western countries
    US: 'USD',
    GB: 'GBP',
    CA: 'CAD',
    AU: 'AUD',
    NZ: 'NZD',

    // Europe
    DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
    CH: 'CHF',
    SE: 'SEK',
    NO: 'NOK',
    DK: 'DKK',

    // Asia
    JP: 'JPY',
    CN: 'CNY',
    IN: 'INR',
    SG: 'SGD',
    HK: 'HKD',

    // Default fallback
    DEFAULT: 'USD'
  };

  /**
   * Get real-time exchange rates from multiple APIs with fallbacks
   */
  static async getExchangeRates() {
    const cacheKey = 'exchange_rates';

    try {
      // Try cache first (5-minute cache)
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Cache get failed for exchange rates:', error.message);
    }

    // Try multiple APIs for reliability
    const apis = [
      () => this.fetchFromExchangeRateAPI(),
      () => this.fetchFromFixer(),
      () => this.fetchFromCurrencyAPI(),
      () => this.getFallbackRates()
    ];

    for (const api of apis) {
      try {
        const rates = await api();
        if (rates && rates.USD === 1) {
          // Cache for 5 minutes
          try {
            await cache.set(cacheKey, JSON.stringify(rates), 300);
          } catch (cacheError) {
            console.warn('Cache set failed:', cacheError.message);
          }
          return rates;
        }
      } catch (error) {
        console.warn('Exchange rate API failed:', error.message);
        continue;
      }
    }

    // Ultimate fallback
    return this.getFallbackRates();
  }

  /**
   * Get supported currencies from Paystack API
   */
  static async getPaystackSupportedCurrencies() {
    const cacheKey = 'paystack_currencies';

    try {
      // Check cache first (24-hour cache)
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Cache get failed for Paystack currencies:', error.message);
    }

    try {
      // Paystack doesn't have a direct currencies endpoint, but we can get it from their config
      const response = await fetch('https://api.paystack.co/country', {
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Paystack API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status && data.data) {
        // Extract currencies from country data
        const currencies = [...new Set(data.data.map(country => country.currency))].filter(Boolean);

        // Cache for 24 hours
        try {
          await cache.set(cacheKey, JSON.stringify(currencies), 86400);
        } catch (cacheError) {
          console.warn('Cache set failed:', cacheError.message);
        }

        console.log('✅ Fetched Paystack currencies from API:', currencies);
        return currencies;
      }

      throw new Error('Invalid Paystack response format');

    } catch (error) {
      console.warn('Failed to fetch Paystack currencies from API:', error.message);

      // Return fallback currencies
      console.log('🔄 Using fallback Paystack currencies');
      return this.FALLBACK_PAYSTACK_CURRENCIES;
    }
  }

  /**
   * Get supported currencies from Flutterwave API
   */
  static async getFlutterwaveSupportedCurrencies() {
    const cacheKey = 'flutterwave_currencies';

    try {
      // Check cache first (24-hour cache)
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Cache get failed for Flutterwave currencies:', error.message);
    }

    try {
      // Method 1: Try settlement currencies endpoint
      let response = await fetch('https://api.flutterwave.com/v3/settlement-currencies', {
        headers: {
          'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          const currencies = data.data.map(item => item.currency).filter(Boolean);

          // Cache for 24 hours
          try {
            await cache.set(cacheKey, JSON.stringify(currencies), 86400);
          } catch (cacheError) {
            console.warn('Cache set failed:', cacheError.message);
          }

          console.log('✅ Fetched Flutterwave currencies from settlement API:', currencies);
          return currencies;
        }
      }

      // Method 2: Try supported countries endpoint as fallback
      response = await fetch('https://api.flutterwave.com/v3/countries', {
        headers: {
          'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          // Extract currencies from countries
          const currencies = [...new Set(data.data.map(country => country.currency))].filter(Boolean);

          // Cache for 24 hours
          try {
            await cache.set(cacheKey, JSON.stringify(currencies), 86400);
          } catch (cacheError) {
            console.warn('Cache set failed:', cacheError.message);
          }

          console.log('✅ Fetched Flutterwave currencies from countries API:', currencies);
          return currencies;
        }
      }

      throw new Error('Both Flutterwave API endpoints failed');

    } catch (error) {
      console.warn('Failed to fetch Flutterwave currencies from API:', error.message);

      // Return fallback currencies
      console.log('🔄 Using fallback Flutterwave currencies');
      return this.FALLBACK_FLUTTERWAVE_CURRENCIES;
    }
  }

  /**
   * Get all supported currencies for both providers (cached)
   */
  static async getAllSupportedCurrencies() {
    try {
      const [paystackCurrencies, flutterwaveCurrencies] = await Promise.all([
        this.getPaystackSupportedCurrencies(),
        this.getFlutterwaveSupportedCurrencies()
      ]);

      return {
        paystack: paystackCurrencies,
        flutterwave: flutterwaveCurrencies,
        all: [...new Set([...paystackCurrencies, ...flutterwaveCurrencies])],
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting all supported currencies:', error);

      // Return fallback
      return {
        paystack: this.FALLBACK_PAYSTACK_CURRENCIES,
        flutterwave: this.FALLBACK_FLUTTERWAVE_CURRENCIES,
        all: [...new Set([...this.FALLBACK_PAYSTACK_CURRENCIES, ...this.FALLBACK_FLUTTERWAVE_CURRENCIES])],
        updatedAt: new Date(),
        fallback: true
      };
    }
  }
  static async fetchFromExchangeRateAPI() {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();

    if (data.rates) {
      return {
        USD: 1,
        ...data.rates
      };
    }
    throw new Error('Invalid response from ExchangeRate-API');
  }

  /**
   * Secondary API - Fixer.io (requires API key)
   */
  static async fetchFromFixer() {
    const apiKey = process.env.FIXER_API_KEY;
    if (!apiKey) throw new Error('Fixer API key not configured');

    const response = await fetch(`https://api.fixer.io/latest?access_key=${apiKey}&base=USD`);
    const data = await response.json();

    if (data.rates) {
      return {
        USD: 1,
        ...data.rates
      };
    }
    throw new Error('Invalid response from Fixer.io');
  }

  /**
   * Third API - CurrencyAPI (backup)
   */
  static async fetchFromCurrencyAPI() {
    const response = await fetch('https://api.currencyapi.com/v3/latest?apikey=YOUR_API_KEY&base_currency=USD');
    const data = await response.json();

    if (data.data) {
      const rates = { USD: 1 };
      Object.entries(data.data).forEach(([currency, info]) => {
        rates[currency] = info.value;
      });
      return rates;
    }
    throw new Error('Invalid response from CurrencyAPI');
  }

  /**
   * Fallback rates (updated manually/weekly)
   */
  static getFallbackRates() {
    return {
      USD: 1,
      EUR: 0.85,
      GBP: 0.73,
      CAD: 1.25,
      AUD: 1.35,
      NZD: 1.45,
      CHF: 0.88,
      JPY: 110,
      CNY: 6.45,
      INR: 74,
      SGD: 1.35,
      HKD: 7.8,
      SEK: 8.5,
      NOK: 8.8,
      DKK: 6.3,
      // Africa - Paystack/Flutterwave regions
      NGN: 460, // Nigeria
      GHS: 6.1,  // Ghana
      ZAR: 14.5, // South Africa
      KES: 110,  // Kenya
      UGX: 3600, // Uganda
      TZS: 2300, // Tanzania
      RWF: 1030, // Rwanda
      ZMW: 16.5, // Zambia
      XAF: 580,  // Central African CFA
      XOF: 580   // West African CFA
    };
  }

  /**
   * Get currency for country code
   */
  static getCurrencyForCountry(countryCode) {
    if (!countryCode) return this.COUNTRY_CURRENCY_MAP.DEFAULT;

    const upperCountryCode = countryCode.toUpperCase();

    // Use the proper country-currency mapping
    return this.COUNTRY_CURRENCY_MAP[upperCountryCode] || this.COUNTRY_CURRENCY_MAP.DEFAULT;
  }

  /**
   * Convert price with real-time rates
   */
  static async convertPrice(usdAmount, targetCurrency, countryCode = null) {
    try {
      // If country code provided, get currency from it
      if (countryCode && !targetCurrency) {
        targetCurrency = this.getCurrencyForCountry(countryCode);
      }

      // Default to USD if no target currency
      if (!targetCurrency) {
        targetCurrency = 'USD';
      }

      // If already USD, return as-is
      if (targetCurrency === 'USD') {
        return {
          amount: usdAmount,
          currency: 'USD',
          rate: 1,
          convertedAt: new Date()
        };
      }

      // Get real-time rates
      const rates = await this.getExchangeRates();
      const rate = rates[targetCurrency];

      if (!rate) {
        console.warn(`Currency ${targetCurrency} not found, falling back to USD`);
        return {
          amount: usdAmount,
          currency: 'USD',
          rate: 1,
          convertedAt: new Date(),
          fallback: true
        };
      }

      const convertedAmount = Math.round(usdAmount * rate * 100) / 100;

      return {
        amount: convertedAmount,
        currency: targetCurrency,
        rate,
        convertedAt: new Date(),
        originalUSD: usdAmount
      };

    } catch (error) {
      console.error('Currency conversion failed:', error);

      // Fallback to USD
      return {
        amount: usdAmount,
        currency: 'USD',
        rate: 1,
        convertedAt: new Date(),
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * Get pricing with real-time conversion for plan
   */
  static async getPlanPricingForCountry(planDefinition, countryCode) {
    // ✅ QUICK FIX: Skip dynamic conversion if env var is set
    if (process.env.SKIP_DYNAMIC_CURRENCY === 'true') {
      console.log('🔧 SKIPPING dynamic currency - using predefined prices');

      const targetCurrency = this.getCurrencyForCountry(countryCode);

      // Try to use the appropriate currency for the country
      if (planDefinition.price?.[targetCurrency] !== undefined) {
        return {
          amount: planDefinition.price[targetCurrency],
          originalAmount: planDefinition.originalPrice?.[targetCurrency] || planDefinition.price[targetCurrency],
          currency: targetCurrency,
          countryCode,
          predefined: true,
          convertedAt: new Date()
        };
      } else {
        // Fallback to USD if target currency not available in plan
        return {
          amount: planDefinition.price.USD,
          originalAmount: planDefinition.originalPrice?.USD || planDefinition.price.USD,
          currency: 'USD',
          countryCode,
          predefined: true,
          fallback: true,
          convertedAt: new Date()
        };
      }
    }

    try {
      const targetCurrency = this.getCurrencyForCountry(countryCode);

      // Try to use the appropriate currency for the country
      if (planDefinition.price?.[targetCurrency] !== undefined) {
        return {
          amount: planDefinition.price[targetCurrency],
          originalAmount: planDefinition.originalPrice?.[targetCurrency] || planDefinition.price[targetCurrency],
          currency: targetCurrency,
          countryCode,
          predefined: true,
          convertedAt: new Date()
        };
      }

      // Fallback to USD if target currency not available in plan
      return {
        amount: planDefinition.price.USD,
        originalAmount: planDefinition.originalPrice?.USD || planDefinition.price.USD,
        currency: 'USD',
        countryCode,
        predefined: true,
        fallback: true,
        convertedAt: new Date()
      };

    } catch (error) {
      console.error('Plan pricing conversion failed:', error);

      // Fallback to predefined pricing based on country
      const targetCurrency = this.getCurrencyForCountry(countryCode);

      if (planDefinition.price?.[targetCurrency] !== undefined) {
        return {
          amount: planDefinition.price[targetCurrency],
          originalAmount: planDefinition.originalPrice?.[targetCurrency] || planDefinition.price[targetCurrency],
          currency: targetCurrency,
          countryCode,
          error: error.message,
          fallback: true,
          convertedAt: new Date()
        };
      } else {
        return {
          amount: planDefinition.price.USD,
          originalAmount: planDefinition.originalPrice?.USD || planDefinition.price.USD,
          currency: 'USD',
          countryCode,
          error: error.message,
          fallback: true,
          convertedAt: new Date()
        };
      }
    }
  }

  /**
   * Check if currency is supported by payment provider (dynamic)
   */
  static async isCurrencySupportedByProvider(currency, provider) {
    try {
      switch (provider.toLowerCase()) {
        case 'paystack':
          const paystackCurrencies = await this.getPaystackSupportedCurrencies();
          return paystackCurrencies.includes(currency);
        case 'flutterwave':
          const flutterwaveCurrencies = await this.getFlutterwaveSupportedCurrencies();
          return flutterwaveCurrencies.includes(currency);
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking currency support:', error);

      // Fallback to static check
      switch (provider.toLowerCase()) {
        case 'paystack':
          return this.FALLBACK_PAYSTACK_CURRENCIES.includes(currency);
        case 'flutterwave':
          return this.FALLBACK_FLUTTERWAVE_CURRENCIES.includes(currency);
        default:
          return false;
      }
    }
  }

  /**
   * Get best payment provider for currency (dynamic)
   */
  static async getBestProviderForCurrency(currency) {
    try {
      const [flutterwaveSupported, paystackSupported] = await Promise.all([
        this.isCurrencySupportedByProvider(currency, 'flutterwave'),
        this.isCurrencySupportedByProvider(currency, 'paystack')
      ]);

      // Flutterwave generally supports more currencies and regions
      if (flutterwaveSupported) {
        return 'flutterwave';
      } else if (paystackSupported) {
        return 'paystack';
      } else {
        // Neither supports it, default to flutterwave as it's more international
        return 'flutterwave';
      }
    } catch (error) {
      console.error('Error determining best provider:', error);
      return 'flutterwave'; // Safe fallback
    }
  }

  /**
   * Validate and adjust currency for payment provider (dynamic)
   */
  static async validateCurrencyForProvider(currency, provider) {
    try {
      const isSupported = await this.isCurrencySupportedByProvider(currency, provider);

      if (isSupported) {
        return { currency, supported: true };
      }

      // Dynamic fallback logic
      const allCurrencies = await this.getAllSupportedCurrencies();

      if (provider === 'paystack') {
        // Paystack fallback priority: USD -> NGN
        if (allCurrencies.paystack.includes('USD')) {
          return { currency: 'USD', supported: false, fallback: true };
        } else if (allCurrencies.paystack.includes('NGN')) {
          return { currency: 'NGN', supported: false, fallback: true };
        }
      } else if (provider === 'flutterwave') {
        // Flutterwave fallback priority: USD -> EUR -> NGN
        if (allCurrencies.flutterwave.includes('USD')) {
          return { currency: 'USD', supported: false, fallback: true };
        } else if (allCurrencies.flutterwave.includes('EUR')) {
          return { currency: 'EUR', supported: false, fallback: true };
        } else if (allCurrencies.flutterwave.includes('NGN')) {
          return { currency: 'NGN', supported: false, fallback: true };
        }
      }

      // Ultimate fallback
      return { currency: 'USD', supported: false, fallback: true };

    } catch (error) {
      console.error('Error validating currency for provider:', error);

      // Static fallback
      const staticSupported = (provider === 'paystack')
        ? this.FALLBACK_PAYSTACK_CURRENCIES.includes(currency)
        : this.FALLBACK_FLUTTERWAVE_CURRENCIES.includes(currency);

      if (staticSupported) {
        return { currency, supported: true };
      }

      return { currency: 'USD', supported: false, fallback: true };
    }
  }

  /**
   * Refresh supported currencies cache (for background jobs)
   */
  static async refreshSupportedCurrencies() {
    try {
      console.log('🔄 Refreshing supported currencies cache...');

      // Clear existing cache
      await Promise.all([
        cache.del('paystack_currencies').catch(() => { }),
        cache.del('flutterwave_currencies').catch(() => { })
      ]);

      // Fetch fresh data
      const result = await this.getAllSupportedCurrencies();

      console.log('✅ Currency cache refreshed:', {
        paystack: result.paystack.length,
        flutterwave: result.flutterwave.length,
        total: result.all.length,
        fallback: result.fallback || false
      });

      return result;
    } catch (error) {
      console.error('❌ Error refreshing currencies cache:', error);
      throw error;
    }
  }

  /**
   * Get formatted price string
   */
  static formatPrice(amount, currency) {
    const formatters = {
      USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
      EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
      GBP: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
      NGN: new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }),
      // Add more as needed
    };

    const formatter = formatters[currency] || formatters.USD;
    return formatter.format(amount);
  }
}

module.exports = CurrencyService;