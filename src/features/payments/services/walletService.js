// ================================
// 7. COMPLETE WALLET SERVICE
// ================================

// src/services/walletService.js
const doctorWalletRepository = require("../repositories/doctorWalletRepository");
const walletWithdrawalRepository = require("../repositories/walletWithdrawalRepository");
const userRepository = require("../../auth/repositories/userRepository");
const axios = require("axios");

// Hardcoded country → currency map. No API calls, instant lookup.
// Covers all countries supported by Flutterwave + Paystack.
const COUNTRY_CURRENCY_MAP = {
  // West Africa
  'nigeria': 'NGN', 'ghana': 'GHS', 'senegal': 'XOF', 'ivory coast': 'XOF',
  "cote d'ivoire": 'XOF', 'mali': 'XOF', 'burkina faso': 'XOF', 'niger': 'XOF',
  'benin': 'XOF', 'togo': 'XOF', 'guinea-bissau': 'XOF', 'sierra leone': 'SLL',
  'liberia': 'USD',
  // East Africa
  'kenya': 'KES', 'tanzania': 'TZS', 'uganda': 'UGX', 'rwanda': 'RWF',
  'ethiopia': 'USD', 'somalia': 'USD',
  // Central Africa
  'cameroon': 'XAF', 'chad': 'XAF', 'central african republic': 'XAF',
  'republic of the congo': 'XAF', 'democratic republic of the congo': 'XAF',
  'gabon': 'XAF', 'equatorial guinea': 'XAF',
  // Southern Africa
  'south africa': 'ZAR', 'zambia': 'ZMW', 'malawi': 'MWK', 'zimbabwe': 'USD',
  'botswana': 'USD', 'namibia': 'USD', 'mozambique': 'USD',
  // North Africa
  'egypt': 'EGP', 'morocco': 'USD', 'algeria': 'USD', 'tunisia': 'USD',
  // Europe
  'united kingdom': 'GBP', 'uk': 'GBP', 'germany': 'EUR', 'france': 'EUR',
  'spain': 'EUR', 'italy': 'EUR', 'netherlands': 'EUR', 'belgium': 'EUR',
  'portugal': 'EUR', 'ireland': 'EUR', 'austria': 'EUR', 'finland': 'EUR',
  'greece': 'EUR', 'sweden': 'USD', 'norway': 'USD', 'denmark': 'USD',
  // Americas
  'united states': 'USD', 'usa': 'USD', 'canada': 'CAD',
  // Oceania
  'australia': 'AUD', 'new zealand': 'USD'
};

// Supported by at least one of Flutterwave or Paystack
const SUPPORTED_CURRENCIES = new Set([
  'NGN', 'USD', 'GHS', 'ZAR', 'KES', 'XOF', 'EGP', 'XAF',
  'EUR', 'GBP', 'UGX', 'TZS', 'SLL', 'MWK', 'ZMW', 'RWF', 'CAD', 'AUD'
]);

class WalletService {
  constructor() {
    this.exchangeRateApi = "https://api.exchangerate-api.com/v4/latest";
    this.paymentService = require("./paymentService");
  }

  async getExchangeRate(from, to) {
    return await this.paymentService.getExchangeRate(from, to);
  }

  /**
   * Resolve the correct display currency for a doctor based on their country.
   * No API calls — instant lookup from hardcoded map.
   * Falls back to USD if country is unknown or currency unsupported.
   */
  resolveCurrencyFromCountry(country) {
    if (!country) return 'USD';
    const currency = COUNTRY_CURRENCY_MAP[country.toLowerCase().trim()];
    if (currency && SUPPORTED_CURRENCIES.has(currency)) return currency;
    return 'USD';
  }

  /**
   * Create a wallet for a doctor — currency auto-detected from country
   */
  async createDoctorWallet(doctorId) {
    const doctor = await userRepository.findById(doctorId);
    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const existingWallet = await doctorWalletRepository.findByDoctorId(doctorId);
    if (existingWallet) {
      throw new Error("Wallet already exists for this doctor");
    }

    const walletData = {
      doctorId,
      totalBalanceUsd: 0.00,
      pendingCreditsUsd: 0.00,
      availableBalanceUsd: 0.00,
      preferredDisplayCurrency: this.resolveCurrencyFromCountry(doctor.country)
    };

    const wallet = doctorWalletRepository.create(walletData);
    return await doctorWalletRepository.save(wallet);
  }

  /**
   * Get doctor's wallet with currency conversion.
   * Auto-syncs display currency from doctor's country on every fetch —
   * so if country changes on their profile, wallet currency updates automatically.
   */
  async getDoctorWallet(doctorId, locationCountry = null) {
    let wallet = await doctorWalletRepository.findByDoctorId(doctorId);
    const doctor = await userRepository.findById(doctorId);

    if (!wallet && (doctor?.role === "doctor" || doctor?.role === "specialist")) {
      console.log(`🔧 Self-healing: Creating missing wallet for doctor ${doctorId}`);
      try {
        wallet = await this.createDoctorWallet(doctorId);
      } catch (createErr) {
        console.error(`❌ Self-healing failed for doctor ${doctorId}:`, createErr.message);
      }
    }

    if (!wallet) {
      throw new Error("Wallet not found for this doctor and self-healing failed.");
    }

    // Auto-sync: resolve correct currency — DB country wins, location middleware is fallback.
    // Only persist to DB when country comes from the doctor's profile (not IP location),
    // so that traveling doesn't permanently flip the wallet currency.
    const dbCountry = doctor?.country || null;
    const effectiveCountry = dbCountry || locationCountry;
    const correctCurrency = this.resolveCurrencyFromCountry(effectiveCountry);

    if (dbCountry && wallet.preferredDisplayCurrency !== correctCurrency) {
      // Profile country is set and wallet currency is stale — persist the fix
      await doctorWalletRepository.repo.update(wallet.id, {
        preferredDisplayCurrency: correctCurrency
      });
    }
    // Always use correctCurrency for this response (whether from DB or IP fallback)
    wallet.preferredDisplayCurrency = correctCurrency;

    const exchangeRate = await this.getExchangeRate('USD', wallet.preferredDisplayCurrency);

    return {
      ...wallet,
      displayBalance: {
        total: (wallet.totalBalanceUsd * exchangeRate).toFixed(2),
        pending: (wallet.pendingCreditsUsd * exchangeRate).toFixed(2),
        available: (wallet.availableBalanceUsd * exchangeRate).toFixed(2),
        currency: wallet.preferredDisplayCurrency
      },
      usdBalance: {
        total: wallet.totalBalanceUsd,
        pending: wallet.pendingCreditsUsd,
        available: wallet.availableBalanceUsd,
        currency: 'USD'
      },
      // 🔧 FIX: Convert minimum withdrawal to display currency
      minimumWithdrawalDisplay: {
        amount: (wallet.minimumWithdrawal * exchangeRate).toFixed(2),
        currency: wallet.preferredDisplayCurrency
      },
      // Keep original USD amount for reference
      minimumWithdrawalUsd: {
        amount: wallet.minimumWithdrawal,
        currency: 'USD'
      }
    };
  }

  /**
   * Get supported currencies from both processors
   */
  async getSupportedCurrencies() {
    try {
      const [flutterwaveCurrencies, paystackCurrencies] = await Promise.all([
        this.getFlutterwaveCurrencies(),
        this.getPaystackCurrencies()
      ]);

      // Merge and enhance currency data
      const allCurrencies = this.mergeCurrencies(flutterwaveCurrencies, paystackCurrencies);

      return {
        success: true,
        data: allCurrencies.sort((a, b) => a.name.localeCompare(b.name))
      };

    } catch (error) {
      console.error('Error fetching currencies:', error);
      return {
        success: false,
        error: 'Failed to fetch supported currencies'
      };
    }
  }

  /**
   * Get Flutterwave supported currencies (Fixed API call)
   */
  async getFlutterwaveCurrencies() {
    try {
      // Use a different endpoint that doesn't require query parameters
      const response = await axios.get(
        'https://api.flutterwave.com/v3/banks/NG',
        {
          headers: {
            'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Since the transfer rates endpoint needs parameters, we'll use known supported currencies
      const supportedCurrencies = ['NGN', 'USD', 'GHS', 'KES', 'UGX', 'EUR', 'GBP'];

      return supportedCurrencies.map(currency => ({
        code: currency,
        name: this.getCurrencyName(currency),
        rate: 1, // Will get actual rate when needed
        processor: 'flutterwave',
        fee: this.getFlutterwaveFee(currency)
      }));

    } catch (error) {
      console.error('Flutterwave currencies error:', error);
      // Return fallback currencies if API fails
      return [
        { code: 'NGN', name: 'Nigerian Naira', rate: 1, processor: 'flutterwave', fee: 50 },
        { code: 'USD', name: 'US Dollar', rate: 1, processor: 'flutterwave', fee: 5 }
      ];
    }
  }

  /**
   * Get Paystack supported currencies
   */
  async getPaystackCurrencies() {
    try {
      // Paystack doesn't have a currencies endpoint, use known supported currencies
      const supportedCurrencies = ['NGN', 'USD', 'GHS', 'ZAR'];

      return supportedCurrencies.map(currency => ({
        code: currency,
        name: this.getCurrencyName(currency),
        rate: 1, // Will get actual rate when needed
        processor: 'paystack',
        fee: this.getPaystackFee(currency)
      }));

    } catch (error) {
      console.error('Paystack currencies error:', error);
      // Return fallback currencies if needed
      return [
        { code: 'NGN', name: 'Nigerian Naira', rate: 1, processor: 'paystack', fee: 100 },
        { code: 'USD', name: 'US Dollar', rate: 1, processor: 'paystack', fee: 10 }
      ];
    }
  }

  /**
   * Get Flutterwave fee for currency
   */
  getFlutterwaveFee(currency) {
    const fees = {
      'NGN': 50,
      'USD': 5,
      'GHS': 2,
      'KES': 100,
      'UGX': 1000,
      'EUR': 3,
      'GBP': 3
    };
    return fees[currency] || 10;
  }

  /**
   * Get Paystack fee for currency
   */
  getPaystackFee(currency) {
    const fees = {
      'NGN': 100,
      'USD': 10,
      'GHS': 5,
      'ZAR': 20
    };
    return fees[currency] || 15;
  }

  /**
   * Merge currencies from both processors
   */
  mergeCurrencies(flutterwaveCurrencies, paystackCurrencies) {
    const currencyMap = new Map();

    // Add Flutterwave currencies
    flutterwaveCurrencies.forEach(currency => {
      currencyMap.set(currency.code, {
        code: currency.code,
        name: currency.name,
        processors: ['flutterwave'],
        rates: {
          flutterwave: currency.rate
        },
        fees: {
          flutterwave: currency.fee
        },
        recommended: this.isRecommendedCurrency(currency.code)
      });
    });

    // Merge Paystack currencies
    paystackCurrencies.forEach(currency => {
      if (currencyMap.has(currency.code)) {
        const existing = currencyMap.get(currency.code);
        existing.processors.push('paystack');
        existing.rates.paystack = currency.rate;
        existing.fees.paystack = currency.fee;
      } else {
        currencyMap.set(currency.code, {
          code: currency.code,
          name: currency.name,
          processors: ['paystack'],
          rates: {
            paystack: currency.rate
          },
          fees: {
            paystack: currency.fee
          },
          recommended: this.isRecommendedCurrency(currency.code)
        });
      }
    });

    return Array.from(currencyMap.values());
  }

  /**
   * Get currency display name
   */
  getCurrencyName(code) {
    const currencyNames = {
      'USD': 'US Dollar',
      'NGN': 'Nigerian Naira',
      'GHS': 'Ghanaian Cedi',
      'KES': 'Kenyan Shilling',
      'UGX': 'Ugandan Shilling',
      'ZAR': 'South African Rand',
      'EUR': 'Euro',
      'GBP': 'British Pound'
    };
    return currencyNames[code] || code;
  }

  /**
   * Check if currency is recommended
   */
  isRecommendedCurrency(code) {
    const recommendedCurrencies = ['NGN', 'USD', 'GHS'];
    return recommendedCurrencies.includes(code);
  }


  /**
   * Initiate a withdrawal request with smart routing
   */
  async initiateWithdrawal(data) {
    const { doctorId, amountUsd: requestedAmount, requestedCurrency, bankDetails } = data;

    console.log("=== WITHDRAWAL REQUEST START ===");
    console.log("Input data:", {
      doctorId,
      requestedAmount, // ✅ Fixed: Use requestedAmount instead of undefined amountUsd
      requestedCurrency,
      bankDetails: bankDetails ? "provided" : "missing"
    });

    console.log("see the doctorid ", doctorId);

    const wallet = await doctorWalletRepository.findByDoctorId(doctorId);
    if (!wallet) {
      throw new Error("Wallet not found for this doctor");
    }

    if (wallet.isFrozen) {
      throw new Error(`Wallet is frozen: ${wallet.frozenReason}`);
    }

    // ✅ MOVED: Convert currency BEFORE balance check
    const exchangeRate = await this.getExchangeRate(requestedCurrency, 'USD');
    const amountInUsd = requestedAmount * exchangeRate;

    // 🔍 LOG: Currency conversion (moved up)
    console.log("Currency conversion:", {
      requestedAmount,
      requestedCurrency,
      exchangeRate,
      amountInUsd
    });

    // 🔍 LOG: Before balance comparison
    console.log("Balance check:", {
      requestedAmountUsd: amountInUsd, // ✅ Fixed: Use converted amount
      availableBalanceUsd: wallet.availableBalanceUsd,
      hasIssue: amountInUsd > wallet.availableBalanceUsd,
      difference: wallet.availableBalanceUsd - amountInUsd
    });

    if (amountInUsd > wallet.availableBalanceUsd) {
      // 🔍 LOG: When insufficient funds error occurs
      console.log("❌ INSUFFICIENT FUNDS ERROR:", {
        requested: amountInUsd, // ✅ Fixed: Use converted amount
        available: wallet.availableBalanceUsd,
        shortfall: amountInUsd - wallet.availableBalanceUsd
      });
      throw new Error("Insufficient available balance");
    }

    if (amountInUsd < wallet.minimumWithdrawal) {
      throw new Error(`Minimum withdrawal amount is $${wallet.minimumWithdrawal}`);
    }

    // Get real-time balances from both processors
    console.log("🔍 Fetching processor balances...");
    const [flutterwaveBalance, paystackBalance] = await Promise.all([
      this.getFlutterwaveBalance(),
      this.getPaystackBalance() // ✅ Fixed: Was calling getFlutterwaveBalance() twice
    ]);

    // 🔍 LOG: Processor balances
    console.log("Processor balances:", {
      flutterwaveBalance,
      paystackBalance,
      total: flutterwaveBalance + paystackBalance
    });

    // Smart routing logic
    const routingStrategy = this.determineRoutingStrategy(
      requestedAmount,
      flutterwaveBalance,
      paystackBalance,
      requestedCurrency,
      exchangeRate
    );

    console.log('Routing strategy:', routingStrategy);

    let withdrawalResults = [];

    // Execute withdrawals based on routing strategy
    for (const route of routingStrategy.routes) {
      const withdrawalData = {
        walletId: wallet.id,
        doctorId,
        amountUsd: route.amountUsd,
        requestedCurrency,
        requestedAmount: route.amount,
        exchangeRateUsed: exchangeRate,
        bankDetails,
        processor: route.processor,
        status: 'pending',
        parentWithdrawalId: routingStrategy.routes.length > 1 ? null : undefined // For split withdrawals
      };

      const withdrawal = walletWithdrawalRepository.create(withdrawalData);
      const savedWithdrawal = await walletWithdrawalRepository.save(withdrawal);

      // 🚀 ADD THIS: Process withdrawal immediately
      const processingResult = await this.processWithdrawal(savedWithdrawal);

      // Handle results based on processor
      if (route.processor === 'flutterwave') {
        if (processingResult.requiresOtp) {
          await walletWithdrawalRepository.updateStatus(savedWithdrawal.id, 'pending_otp');
          console.log(`💌 Flutterwave withdrawal ${savedWithdrawal.id} requires user OTP`);
        } else if (processingResult.success) {
          await walletWithdrawalRepository.updateStatus(savedWithdrawal.id, 'completed');
          console.log(`✅ Flutterwave withdrawal ${savedWithdrawal.id} completed`);
        } else {
          await walletWithdrawalRepository.updateStatus(savedWithdrawal.id, 'failed');
          // Refund money
          const refundAmountUsd = route.amountUsd;
          await doctorWalletRepository.addAvailableBalance(doctorId, refundAmountUsd);
          console.log(`❌ Flutterwave withdrawal failed, refunded $${refundAmountUsd}`);
        }
      } else if (route.processor === 'paystack') {
        // Keep your existing Paystack logic - it's already correct
        if (processingResult.requiresOtp) {
          await walletWithdrawalRepository.updateStatus(savedWithdrawal.id, 'pending_otp');
          console.log(`💌 Paystack withdrawal ${savedWithdrawal.id} requires user OTP`);
        } else if (processingResult.success) {
          await walletWithdrawalRepository.updateStatus(savedWithdrawal.id, 'completed');
          console.log(`✅ Paystack withdrawal ${savedWithdrawal.id} completed`);
        } else {
          await walletWithdrawalRepository.updateStatus(savedWithdrawal.id, 'failed');
          // Refund money
          const refundAmountUsd = route.amountUsd;
          await doctorWalletRepository.addAvailableBalance(doctorId, refundAmountUsd);
          console.log(`❌ Paystack withdrawal failed, refunded $${refundAmountUsd}`);
        }
      }

      withdrawalResults.push({
        withdrawal: savedWithdrawal,
        processor: route.processor,
        amount: route.amount,
        requiresOtp: processingResult.requiresOtp || false
      });
    }

    // If it's a split withdrawal, link them together
    if (withdrawalResults.length > 1) {
      const parentId = withdrawalResults[0].withdrawal.id;
      for (let i = 1; i < withdrawalResults.length; i++) {
        await walletWithdrawalRepository.updateParentWithdrawalId(
          withdrawalResults[i].withdrawal.id,
          parentId
        );
      }
    }

    // Deduct from available balance (use converted USD amount)
    await doctorWalletRepository.deductAvailableBalance(doctorId, amountInUsd); // ✅ Fixed

    // At the very end before returning
    console.log("=== WITHDRAWAL REQUEST SUCCESS ===");
    console.log("Final result:", {
      withdrawalCount: withdrawalResults.length,
      totalAmount: requestedAmount,
      currency: requestedCurrency,
      routingStrategy: routingStrategy.type
    });

    return {
      withdrawals: withdrawalResults,
      totalAmount: requestedAmount,
      currency: requestedCurrency,
      routingStrategy: routingStrategy.type,
      message: routingStrategy.routes.length > 1 ?
        'Withdrawal will be processed in multiple transactions' :
        'Withdrawal will be processed as single transaction'
    };
  }

  /**
   * Resolve bank account details using smart routing
   */
  async resolveAccountDetails(accountNumber, bankCode) {
    try {
      // Try Flutterwave first
      if (this.isFlutterwaveSupported(bankCode)) {
        const flutterwaveResult = await this.resolveWithFlutterwave(accountNumber, bankCode);
        if (flutterwaveResult.success) {
          return {
            success: true,
            data: {
              accountNumber,
              bankCode,
              accountName: flutterwaveResult.accountName,
              bankName: flutterwaveResult.bankName,
              resolvedVia: 'flutterwave'
            }
          };
        }
      }

      // If Flutterwave fails, try Paystack
      const paystackResult = await this.resolveWithPaystack(accountNumber, bankCode);
      if (paystackResult.success) {
        return {
          success: true,
          data: {
            accountNumber,
            bankCode,
            accountName: paystackResult.accountName,
            bankName: paystackResult.bankName,
            resolvedVia: 'paystack'
          }
        };
      }

      // Both failed
      return {
        success: false,
        error: 'Unable to resolve account details. Please verify account number and bank.'
      };

    } catch (error) {
      console.error('Account resolution error:', error);
      return {
        success: false,
        error: 'Failed to resolve account details'
      };
    }
  }

  /**
 * Check if Flutterwave supports this bank code for resolution
 */
  isFlutterwaveSupported(bankCode) {
    // Flutterwave test environment only supports Access Bank (044)
    // Add more codes when you know they work
    const supportedBanks = ['044']; // Only Access Bank for now

    return supportedBanks.includes(bankCode);
  }

  /**
   * Resolve account with Flutterwave
   */
  async resolveWithFlutterwave(accountNumber, bankCode) {
    try {
      const response = await axios.post(
        'https://api.flutterwave.com/v3/accounts/resolve',
        {
          account_number: accountNumber,
          account_bank: bankCode
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status === 'success' && response.data.data) {
        return {
          success: true,
          accountName: response.data.data.account_name,
          bankName: response.data.data.account_bank || 'Unknown Bank'
        };
      }

      return {
        success: false,
        error: response.data.message || 'Account resolution failed'
      };

    } catch (error) {
      console.error('Flutterwave resolution error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Flutterwave resolution failed'
      };
    }
  }

  /**
   * Resolve account with Paystack
   */
  async resolveWithPaystack(accountNumber, bankCode) {
    try {
      const response = await axios.get(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status && response.data.data) {
        return {
          success: true,
          accountName: response.data.data.account_name,
          bankName: await this.getBankNameFromCode(bankCode)
        };
      }

      return {
        success: false,
        error: response.data.message || 'Account resolution failed'
      };

    } catch (error) {
      console.error('Paystack resolution error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Paystack resolution failed'
      };
    }
  }

  /**
 * Get bank name from bank code dynamically
 */
  async getBankNameFromCode(bankCode) {
    try {
      // Get banks from both processors
      const [flutterwaveBanks, paystackBanks] = await Promise.all([
        this.getFlutterwaveBanks(),
        this.getPaystackBanks()
      ]);

      // Search in Flutterwave banks first
      const flutterwaveBank = flutterwaveBanks.find(bank => bank.code === bankCode);
      if (flutterwaveBank) {
        return flutterwaveBank.name;
      }

      // Search in Paystack banks
      const paystackBank = paystackBanks.find(bank => bank.code === bankCode);
      if (paystackBank) {
        return paystackBank.name;
      }

      return 'Unknown Bank';

    } catch (error) {
      console.error('Error getting bank name:', error);
      // Fallback to hardcoded major banks
      return this.getFallbackBankName(bankCode);
    }
  }

  /**
   * Fallback bank names for major banks only
   */
  getFallbackBankName(bankCode) {
    const majorBanks = {
      // Major Banks
      '044': 'Access Bank',
      '057': 'Zenith Bank',
      '058': 'Guaranty Trust Bank',
      '011': 'First Bank of Nigeria',
      '221': 'Stanbic IBTC Bank',
      '214': 'First City Monument Bank',
      '070': 'Fidelity Bank',
      '232': 'Sterling Bank',
      '032': 'Union Bank of Nigeria',
      '033': 'United Bank for Africa',
      '215': 'Unity Bank',
      '035': 'Wema Bank',
      '050': 'Ecobank Nigeria',
      '082': 'Keystone Bank',
      '084': 'Enterprise Bank',
      '023': 'CitiBank',
      '030': 'Heritage Bank',
      '076': 'Polaris Bank',
      '101': 'Providus Bank',
      '103': 'Globus Bank',
      '301': 'JAIZ Bank',
      '068': 'Standard Chartered Bank',

      // Digital Banks
      '100': 'SunTrust Bank',
      '102': 'Titan Bank',
      '104': 'Parallex Bank',
      '105': 'PremiumTrust Bank',
      '106': 'Signature Bank Ltd',
      '107': 'Optimus Bank Limited',
      '108': 'Alpha Morgan Bank',

      // Microfinance Banks (Popular ones)
      '090267': 'Kuda Bank',
      '090405': 'Moniepoint Microfinance Bank',
      '090551': 'Fairmoney Microfinance Bank',
      '090328': 'Eyowo MFB',
      '090194': 'NIRSAL Microfinance Bank',
      '090136': 'Baobab Microfinance Bank',
      '090177': 'Lapo Microfinance Bank',
      '090180': 'AMJU Unique Microfinance Bank',
      '090198': 'RenMoney Microfinance Bank',
      '090426': 'Tangerine Bank',

      // Mortgage Banks
      '070001': 'NPF MicroFinance Bank',
      '070002': 'Fortis Microfinance Bank',
      '070006': 'Covenant Microfinance Bank',
      '070007': 'Omoluabi Savings and Loans',
      '070008': 'Page Financials',
      '070009': 'Gateway Mortgage Bank',
      '070010': 'Abbey Mortgage Bank',
      '070011': 'Refuge Mortgage Bank',
      '070012': 'Lagos Building Investment Company',
      '070013': 'Platinum Mortgage Bank',
      '070014': 'First Generation Mortgage Bank',
      '070015': 'Brent Mortgage Bank',
      '070016': 'Infinity Trust Mortgage Bank',
      '070017': 'Haggai Mortgage Bank Limited',
      '070019': 'Mayfresh Mortgage Bank',
      '070021': 'Coop Mortgage Bank',
      '070022': 'Stb Mortgage Bank',
      '070023': 'Delta Trust Mortgage Bank',
      '070024': 'Homebase Mortgage',
      '070025': 'Akwa Savings & Loans Limited',
      '070026': 'Fha Mortgage Bank Ltd',

      // Merchant Banks
      '060001': 'Coronation Merchant Bank',
      '060002': 'FBNQUEST Merchant Bank',
      '060003': 'Nova Merchant Bank',
      '060004': 'Greenwich Merchant Bank',

      // Payment Service Banks
      '120001': '9 Payment Service Bank',
      '120002': 'Hopepsb',
      '120003': 'Momo Psb',
      '120004': 'Smartcash Payment Service Bank',
      '120005': 'Money Master Psb',

      // Finance Companies
      '050001': 'County Finance Ltd',
      '050002': 'Fewchore Finance Company Limited',
      '050003': 'Sagegrey Finance Limited',
      '050004': 'Newedge Finance Ltd',
      '050005': 'Aaa Finance',
      '050006': 'Branch International Financial Services',
      '050007': 'Tekla Finance Ltd',
      '050008': 'Simple Finance Limited',
      '050009': 'Fast Credit',
      '050010': 'Fundquest Financial Services Ltd',
      '050012': 'Enco Finance',
      '050013': 'Dignity Finance',
      '050014': 'Trinity Financial Services Limited',

      // Central Bank
      '000028': 'Central Bank Of Nigeria',
      '000029': 'Lotus Bank',
      '000025': 'Titan Trust Bank',
      '000026': 'Taj Bank Limited',
      '000030': 'Parallex Bank',
      '000031': 'PremiumTrust Bank',
      '000033': 'ENaira',
      '000034': 'Signature Bank',
      '000036': 'Optimus Bank'
    };

    return majorBanks[bankCode] || 'Unknown Bank';
  }

  /**
   * Get list of supported banks from both processors
   */
  async getSupportedBanks() {
    try {
      const [flutterwaveBanks, paystackBanks] = await Promise.all([
        this.getFlutterwaveBanks(),
        this.getPaystackBanks()
      ]);

      // Merge and deduplicate banks
      const allBanks = [...flutterwaveBanks, ...paystackBanks];
      const uniqueBanks = allBanks.reduce((acc, bank) => {
        const existing = acc.find(b => b.code === bank.code);
        if (!existing) {
          acc.push(bank);
        }
        return acc;
      }, []);

      return {
        success: true,
        data: uniqueBanks.sort((a, b) => a.name.localeCompare(b.name))
      };

    } catch (error) {
      console.error('Error fetching banks:', error);
      return {
        success: false,
        error: 'Failed to fetch supported banks'
      };
    }
  }

  /**
   * Get Flutterwave banks
   */
  async getFlutterwaveBanks() {
    try {
      const response = await axios.get(
        'https://api.flutterwave.com/v3/banks/NG',
        {
          headers: {
            'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status === 'success') {
        return response.data.data.map(bank => ({
          name: bank.name,
          code: bank.code,
          processor: 'flutterwave'
        }));
      }

      return [];
    } catch (error) {
      console.error('Flutterwave banks error:', error);
      return [];
    }
  }

  /**
   * Get Paystack banks
   */
  async getPaystackBanks() {
    try {
      const response = await axios.get(
        'https://api.paystack.co/bank',
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status) {
        return response.data.data.map(bank => ({
          name: bank.name,
          code: bank.code,
          processor: 'paystack'
        }));
      }

      return [];
    } catch (error) {
      console.error('Paystack banks error:', error);
      return [];
    }
  }

  /**
   * Determine the best routing strategy for withdrawal
   */
  determineRoutingStrategy(requestedAmount, flutterwaveBalance, paystackBalance, currency, exchangeRate) {
    const routes = [];

    // Strategy 1: Single processor has enough funds
    if (flutterwaveBalance >= requestedAmount) {
      routes.push({
        processor: 'flutterwave',
        amount: requestedAmount,
        amountUsd: requestedAmount * exchangeRate
      });
      return { type: 'single_flutterwave', routes };
    }

    if (paystackBalance >= requestedAmount) {
      routes.push({
        processor: 'paystack',
        amount: requestedAmount,
        amountUsd: requestedAmount * exchangeRate
      });
      return { type: 'single_paystack', routes };
    }

    // Strategy 2: Split between both processors
    const totalAvailable = flutterwaveBalance + paystackBalance;

    if (totalAvailable < requestedAmount) {
      throw new Error('Insufficient funds across all payment processors');
    }

    // Split proportionally or use available amounts
    if (flutterwaveBalance > 0) {
      routes.push({
        processor: 'flutterwave',
        amount: flutterwaveBalance,
        amountUsd: flutterwaveBalance * exchangeRate
      });
    }

    const remainingAmount = requestedAmount - flutterwaveBalance;
    if (remainingAmount > 0 && paystackBalance >= remainingAmount) {
      routes.push({
        processor: 'paystack',
        amount: remainingAmount,
        amountUsd: remainingAmount * exchangeRate
      });
    }

    return { type: 'split_withdrawal', routes };
  }

  /**
   * Get Flutterwave wallet balance
   */
  // In getFlutterwaveBalance method
  async getFlutterwaveBalance() {
    try {
      console.log("🔍 Fetching Flutterwave balance...");
      const response = await axios.get('https://api.flutterwave.com/v3/balances', {
        headers: {
          'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const ngnBalance = response.data.data.find(balance => balance.currency === 'NGN');
      const balance = ngnBalance ? ngnBalance.available_balance : 0;

      console.log("Flutterwave balance result:", {
        found: !!ngnBalance,
        balance,
        allBalances: response.data.data
      });

      return balance;
    } catch (error) {
      console.error('❌ Error fetching Flutterwave balance:', error.message);
      return 0;
    }
  }


  /**
   * Get Paystack balance
   */
  async getPaystackBalance() {
    try {
      console.log("🔍 Fetching Paystack balance...");
      const response = await axios.get('https://api.paystack.co/balance', {
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const balance = response.data.data[0].balance / 100;

      console.log("Paystack balance result:", {
        rawBalance: response.data.data[0].balance,
        convertedBalance: balance,
        currency: response.data.data[0].currency
      });

      return balance;
    } catch (error) {
      console.error('❌ Error fetching Paystack balance:', error.message);
      return 0;
    }
  }

  /**
   * Process withdrawal based on processor
   */
  async processWithdrawal(withdrawal) {
    console.log('🔍 Processing withdrawal with processor:', `"${withdrawal.processor}"`);

    if (withdrawal.processor === 'flutterwave') {
      // Flutterwave: Direct processing, no OTP needed
      return await this.processBankWithdrawal(withdrawal);

    } else if (withdrawal.processor === 'paystack') {
      // Paystack: May require OTP
      return await this.processPaystackWithdrawal(withdrawal);

    } else {
      throw new Error('Unknown payment processor');
    }
  }

  /**
 * Process Flutterwave bank withdrawal
 */
  async processBankWithdrawal(withdrawal) {
    try {
      const payload = {
        account_bank: withdrawal.bankDetails.bankCode,
        account_number: withdrawal.bankDetails.accountNumber,
        amount: withdrawal.requestedAmount,
        currency: withdrawal.requestedCurrency,
        narration: `CosmicForge withdrawal for Dr. ${withdrawal.bankDetails.accountName}`,
        reference: `WDW-FW-${withdrawal.id}-${Date.now()}`,
        callback_url: `${process.env.BASE_URL}/webhooks/flutterwave/transfer`,
        debit_currency: withdrawal.requestedCurrency
      };

      const response = await axios.post(
        'https://api.flutterwave.com/v3/transfers',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status === 'success') {
        // ADD: Same custom OTP system as Paystack
        console.log('🔐 Setting up custom OTP system for Flutterwave...');

        const otpCode = this.generateOtp();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store OTP details in our database
        await walletWithdrawalRepository.updateOtpDetails(withdrawal.id, otpCode, otpExpiresAt);

        // Send our custom OTP email
        await this.sendCustomOtp(withdrawal.doctorId, otpCode, withdrawal);

        console.log('✅ Custom OTP system setup complete');

        return {
          success: true,
          requiresOtp: true,
          status: 'pending_otp',
          message: 'Withdrawal initiated. Please check your email for the verification code.'
        };
      }

      return {
        success: false,
        error: response.data.message || 'Transfer failed'
      };
    } catch (error) {
      console.error('Flutterwave withdrawal error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Withdrawal processing failed'
      };
    }
  }

  /**
   * Process Paystack withdrawal with custom OTP
   */
  async processPaystackWithdrawal(withdrawal) {
    try {
      console.log('🚀 === PAYSTACK WITHDRAWAL WITH CUSTOM OTP START ===');
      console.log('Withdrawal Data:', {
        id: withdrawal.id,
        amount: withdrawal.requestedAmount,
        currency: withdrawal.requestedCurrency,
        bankDetails: withdrawal.bankDetails
      });

      // STEP 1: Create Transfer Recipient
      const recipientPayload = {
        type: 'nuban',
        name: withdrawal.bankDetails.accountName,
        account_number: withdrawal.bankDetails.accountNumber,
        bank_code: withdrawal.bankDetails.bankCode,
        currency: withdrawal.requestedCurrency
      };

      console.log('📝 Creating recipient with payload:', recipientPayload);

      const recipientResponse = await axios.post(
        'https://api.paystack.co/transferrecipient',
        recipientPayload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('📥 Recipient Response:', JSON.stringify(recipientResponse.data, null, 2));

      if (!recipientResponse.data.status) {
        console.log('❌ Recipient creation failed');
        return {
          success: false,
          error: recipientResponse.data.message || 'Failed to create recipient'
        };
      }

      const recipientCode = recipientResponse.data.data.recipient_code;
      console.log('✅ Recipient created:', recipientCode);

      // STEP 2: Initiate Transfer
      const transferPayload = {
        source: 'balance',
        amount: withdrawal.requestedAmount * 100, // Convert to kobo
        recipient: recipientCode,
        reason: `CosmicForge withdrawal for Dr. ${withdrawal.bankDetails.accountName}`,
        reference: `WDW-PS-${withdrawal.id}-${Date.now()}`
      };

      console.log('💸 Initiating transfer with payload:', transferPayload);

      const transferResponse = await axios.post(
        'https://api.paystack.co/transfer',
        transferPayload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('📤 Transfer Response:', JSON.stringify(transferResponse.data, null, 2));

      if (transferResponse.data.status) {
        // REMOVE: All Paystack OTP logic
        // ADD: Our custom OTP system

        console.log('🔐 Setting up custom OTP system...');

        const otpCode = this.generateOtp();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store OTP details in our database
        await walletWithdrawalRepository.updateOtpDetails(withdrawal.id, otpCode, otpExpiresAt);

        // Send our custom OTP email
        await this.sendCustomOtp(withdrawal.doctorId, otpCode, withdrawal);

        console.log('✅ Custom OTP system setup complete');

        return {
          success: true,
          requiresOtp: true,
          status: 'pending_otp',
          message: 'Withdrawal initiated. Please check your email for the verification code.'
        };
      } else {
        return {
          success: false,
          error: transferResponse.data.message || 'Transfer initiation failed'
        };
      }

    } catch (error) {
      console.error('❌ Paystack withdrawal error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Withdrawal processing failed'
      };
    }
  }

  /**
   * Generate 6-digit OTP code
   */
  generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send custom OTP email to doctor
   */
  async sendCustomOtp(doctorId, otpCode, withdrawal) {
    try {
      const doctor = await userRepository.findById(doctorId);
      if (!doctor) {
        throw new Error('Doctor not found for OTP notification');
      }

      const emailService = require('../../../shared/services/email/emailHelpers');
      await emailService.sendCustomWithdrawalOtp({
        to: doctor.email,
        doctorName: doctor.firstName + ' ' + doctor.lastName,
        otpCode,
        amount: withdrawal.requestedAmount,
        currency: withdrawal.requestedCurrency,
        accountName: withdrawal.bankDetails.accountName,
        withdrawalId: withdrawal.id,
        otpCompletionUrl: `${process.env.FRONTEND_URL}/wallet/complete-withdrawal/${withdrawal.id}`,
        expiresInMinutes: 10
      });

      console.log(`✅ Custom OTP sent to ${doctor.email} for withdrawal ${withdrawal.id}`);
    } catch (error) {
      console.error('Error sending custom OTP:', error);
      throw error;
    }
  }

  /**
   * Verify custom OTP and optional wallet password
   */
  async verifyCustomOtp(withdrawalId, userOtp, doctorId, walletPassword = null) {
    try {
      console.log(`🔍 Verifying OTP for withdrawal ${withdrawalId}`);

      // Get withdrawal with OTP details
      const withdrawal = await walletWithdrawalRepository.findWithOtpDetails(withdrawalId);

      if (!withdrawal || withdrawal.doctorId !== doctorId) {
        throw new Error('Withdrawal not found or unauthorized');
      }

      if (withdrawal.status !== 'pending_otp') {
        throw new Error('Withdrawal is not pending OTP verification');
      }

      // Check if OTP expired
      if (new Date() > withdrawal.otpExpiresAt) {
        console.log(`❌ OTP expired for withdrawal ${withdrawalId}`);
        throw new Error('OTP has expired. Please request a new one.');
      }

      // Check max attempts
      const maxAttempts = withdrawal.maxOtpAttempts || 3;
      if (withdrawal.otpAttempts >= maxAttempts) {
        await walletWithdrawalRepository.blockWithdrawalOtp(withdrawalId);
        console.log(`❌ Max OTP attempts exceeded for withdrawal ${withdrawalId}`);
        throw new Error('Maximum OTP attempts exceeded. Withdrawal has been blocked.');
      }

      // Verify OTP
      if (withdrawal.otpCode !== userOtp) {
        await walletWithdrawalRepository.incrementOtpAttempts(withdrawalId);
        const attemptsLeft = maxAttempts - (withdrawal.otpAttempts + 1);
        console.log(`❌ Invalid OTP for withdrawal ${withdrawalId}. ${attemptsLeft} attempts left`);
        throw new Error(`Invalid OTP. ${attemptsLeft} attempts remaining.`);
      }

      // If wallet password is required, verify it
      if (walletPassword) {
        const isPasswordValid = await this.verifyWalletPassword(doctorId, walletPassword);
        if (!isPasswordValid) {
          console.log(`❌ Invalid wallet password for doctor ${doctorId}`);
          throw new Error('Invalid wallet password');
        }
        console.log(`✅ Wallet password verified for doctor ${doctorId}`);
      }

      // Mark OTP as verified and update status to processing
      await walletWithdrawalRepository.markOtpAsVerified(withdrawalId);

      console.log(`✅ OTP verified successfully for withdrawal ${withdrawalId}`);

      // Complete the actual withdrawal processing here
      await this.completeWithdrawalProcessing(withdrawal);

      return {
        success: true,
        message: 'Withdrawal completed successfully! Money will reflect in your account shortly.',
        withdrawalId: withdrawalId
      };

    } catch (error) {
      console.error('Custom OTP verification error:', error);
      throw error;
    }
  }

  /**
   * Complete withdrawal processing after OTP verification
   */
  async completeWithdrawalProcessing(withdrawal) {
    try {
      // For Paystack withdrawals, we need to finalize the transfer
      if (withdrawal.processor === 'paystack') {
        // The transfer was already initiated, just mark as completed
        await walletWithdrawalRepository.updateStatus(withdrawal.id, 'completed');
        console.log(`✅ Paystack withdrawal ${withdrawal.id} marked as completed`);
      }
      // For Flutterwave, the transfer is already processing
      else if (withdrawal.processor === 'flutterwave') {
        await walletWithdrawalRepository.updateStatus(withdrawal.id, 'completed');
        console.log(`✅ Flutterwave withdrawal ${withdrawal.id} marked as completed`);
      }
    } catch (error) {
      console.error('Error completing withdrawal processing:', error);
      // Mark as failed and refund if needed
      await walletWithdrawalRepository.updateStatus(withdrawal.id, 'failed', {
        failureReason: error.message
      });
      throw error;
    }
  }

  /**
   * Resend OTP for a withdrawal
   */
  async resendWithdrawalOtp(withdrawalId, doctorId) {
    try {
      const withdrawal = await walletWithdrawalRepository.findWithOtpDetails(withdrawalId);

      if (!withdrawal || withdrawal.doctorId !== doctorId) {
        throw new Error('Withdrawal not found or unauthorized');
      }

      if (withdrawal.status !== 'pending_otp') {
        throw new Error('Withdrawal is not pending OTP verification');
      }

      // Generate new OTP
      const newOtpCode = this.generateOtp();
      const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Reset OTP details
      await walletWithdrawalRepository.resetOtpDetails(withdrawalId, newOtpCode, newExpiresAt);

      // Send new OTP
      await this.sendCustomOtp(doctorId, newOtpCode, withdrawal);

      return {
        success: true,
        message: 'New OTP sent to your email'
      };

    } catch (error) {
      console.error('Error resending OTP:', error);
      throw error;
    }
  }

  /**
   * Set wallet password for doctor
   */
  async setWalletPassword(doctorId, password) {
    try {
      if (!password || password.length < 4) {
        throw new Error('Password must be at least 4 characters long');
      }

      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 12);

      await doctorWalletRepository.setWalletPassword(doctorId, hashedPassword);

      console.log(`✅ Wallet password set for doctor ${doctorId}`);
      return {
        success: true,
        message: 'Wallet password set successfully'
      };

    } catch (error) {
      console.error('Error setting wallet password:', error);
      throw error;
    }
  }

  /**
   * Update wallet password (requires current password - for logged in users)
   */
  async updateWalletPassword(doctorId, currentPassword, newPassword) {
    try {
      // Verify current password first
      const isCurrentPasswordValid = await this.verifyWalletPassword(doctorId, currentPassword);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      if (!newPassword || newPassword.length < 4) {
        throw new Error('New Password must be at least 4 characters long');
      }

      const bcrypt = require('bcryptjs');
      const hashednewPassword = await bcrypt.hash(newPassword, 12);

      await doctorWalletRepository.updateWalletPassword(doctorId, hashednewPassword);

      console.log(`✅ Wallet password updated for doctor ${doctorId}`);
      return {
        success: true,
        message: 'Wallet password updated successfully'
      };

    } catch (error) {
      console.error('Error updating wallet password:', error);
      throw error;
    }
  }

  /**
   * Request wallet password reset via email
   */
  async requestWalletPasswordReset(doctorId) {
    try {
      const doctor = await userRepository.findById(doctorId);
      if (!doctor) {
        throw new Error('Doctor not found');
      }

      // Check if doctor has a wallet password set
      const hasPassword = await this.hasWalletPassword(doctorId);
      if (!hasPassword) {
        throw new Error('No wallet password is set for this account');
      }

      // Check if too many reset attempts
      const exceededAttempts = await doctorWalletRepository.hasExceededResetAttempts(doctorId);
      if (exceededAttempts) {
        throw new Error('Too many reset attempts. Please try again later.');
      }

      // Generate secure reset token
      const crypto = require('node:crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      // Store reset token
      await doctorWalletRepository.storeWalletPasswordResetToken(doctorId, resetToken, resetTokenExpiry);

      // Send reset email
      const emailHelpers = require('../../../shared/services/email/emailHelpers');
      await emailHelpers.sendWalletPasswordResetEmail({
        to: doctor.email,
        doctorName: doctor.firstName + ' ' + doctor.lastName,
        resetToken,
        resetUrl: `${process.env.FRONTEND_URL}/doctors/dashboard/settings/wallet/reset-password?token=${resetToken}`,
        expiresInMinutes: 30
      });

      console.log(`✅ Wallet password reset email sent to ${doctor.email}`);

      return {
        success: true,
        message: 'Password reset instructions have been sent to your email'
      };

    } catch (error) {
      console.error('Error requesting wallet password reset:', error);
      throw error;
    }
  }

  /**
   * Reset wallet password using email token
   */
  async resetWalletPasswordWithToken(resetToken, newPassword) {
    try {
      if (!resetToken || !newPassword) {
        throw new Error('Reset token and new password are required');
      }

      if (newPassword.length < 4) {
        throw new Error('Password must be at least 4 characters long');
      }

      // Find wallet by token
      const wallet = await doctorWalletRepository.findByWalletPasswordResetToken(resetToken);
      if (!wallet) {
        throw new Error('Invalid or expired reset token');
      }

      // Check attempts
      if (wallet.walletPasswordResetAttempts >= 3) {
        await doctorWalletRepository.incrementPasswordResetAttempts(wallet.doctorId);
        throw new Error('Too many reset attempts. Please request a new reset link.');
      }

      // Hash new password
      const bcrypt = require('bcryptjs');
      const hashednewPassword = await bcrypt.hash(newPassword, 12);

      // Reset password and clear token
      await doctorWalletRepository.resetWalletPasswordWithToken(resetToken, hashednewPassword);

      console.log(`✅ Wallet password reset successfully for doctor ${wallet.doctorId}`);

      // Send confirmation email
      const emailService = require('../../../shared/services/email/emailHelpers');
      await emailService.sendWalletPasswordResetConfirmationEmail({
        to: wallet.doctor.email,
        doctorName: wallet.doctor.firstName + ' ' + wallet.doctor.lastName
      });

      return {
        success: true,
        message: 'Wallet password has been reset successfully'
      };

    } catch (error) {
      console.error('Error resetting wallet password:', error);

      // If it's an invalid token, try to increment attempts if we can find the wallet
      if (error.message.includes('Invalid or expired')) {
        try {
          const wallet = await doctorWalletRepository.repo.findOne({
            where: { walletPasswordResetToken: resetToken }
          });
          if (wallet) {
            await doctorWalletRepository.incrementPasswordResetAttempts(wallet.doctorId);
          }
        } catch (incrementError) {
          console.error('Error incrementing reset attempts:', incrementError);
        }
      }

      throw error;
    }
  }

  /**
   * Verify wallet password reset token (for frontend validation)
   */
  async verifyWalletPasswordResetToken(resetToken) {
    try {
      const wallet = await doctorWalletRepository.findByWalletPasswordResetToken(resetToken);
      return {
        valid: !!wallet,
        expired: !wallet,
        doctorName: wallet ? (wallet.doctor.firstName + ' ' + wallet.doctor.lastName) : null
      };
    } catch (error) {
      console.error('Error verifying reset token:', error);
      return {
        valid: false,
        expired: true,
        doctorName: null
      };
    }
  }

  /**
   * Verify wallet password
   */
  async verifyWalletPassword(doctorId, password) {
    try {
      const bcrypt = require('bcryptjs');
      const wallet = await doctorWalletRepository.findWalletPassword(doctorId);

      if (!wallet?.walletPassword) {
        return false;
      }

      return await bcrypt.compare(password, wallet.walletPassword);
    } catch (error) {
      console.error('Error verifying wallet password:', error);
      return false;
    }
  }

  /**
   * Check if doctor has wallet password
   */
  async hasWalletPassword(doctorId) {
    try {
      return await doctorWalletRepository.hasWalletPassword(doctorId);
    } catch (error) {
      console.error('Error checking wallet password:', error);
      return false;
    }
  }


  /**
 * Update doctor's preferred display currency
 */
  // In your wallet service
  async updateDisplayCurrency(doctorId, newCurrency) {
    console.log(`Updating currency for doctor ${doctorId} to ${newCurrency}`);

    const wallet = await doctorWalletRepository.findByDoctorId(doctorId);
    if (!wallet) {
      throw new Error("Wallet not found for this doctor");
    }

    console.log(`Current currency: ${wallet.preferredDisplayCurrency}`);

    const updateResult = await doctorWalletRepository.updateDisplayCurrency(doctorId, newCurrency);
    console.log(`Update result:`, updateResult);

    return await this.getDoctorWallet(doctorId);
  }

  /**
   * Get withdrawal history
   */
  async getWithdrawalHistory(doctorId) {
    return await walletWithdrawalRepository.findByDoctorId(doctorId);
  }

  /**
   * Freeze a doctor's wallet
   */
  async freezeWallet(doctorId, reason) {
    await doctorWalletRepository.freezeWallet(doctorId, reason);
  }

  /**
   * Unfreeze a doctor's wallet
   */
  async unfreezeWallet(doctorId) {
    await doctorWalletRepository.unfreezeWallet(doctorId);
  }
}

module.exports = new WalletService();