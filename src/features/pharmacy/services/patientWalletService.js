const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const patientWalletRepo    = require("../repositories/patientWalletRepository");
const patientWalletTxnRepo = require("../repositories/patientWalletTransactionRepository");
const CurrencyService      = require("../../payments/services/currencyService");

const { PatientTxnType, PatientTxnStatus, PatientTxnCategory } = require("../entities/PatientWalletTransaction");

const PAYSTACK_SECRET  = process.env.PAYSTACK_SECRET_KEY;
const FLUTTER_SECRET   = process.env.FLUTTERWAVE_SECRET_KEY;

function generateReference() {
  return `PWU-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
}

/**
 * Get or create a patient wallet.
 */
async function ensureWallet(patientId, displayCurrency = "USD") {
  let wallet = await patientWalletRepo.findByPatientId(patientId);
  if (!wallet) {
    wallet = await patientWalletRepo.save({
      patientId,
      preferredDisplayCurrency: displayCurrency,
    });
  }
  return wallet;
}

const patientWalletService = {

  /**
   * GET /patient/wallet/summary
   */
  async getSummary(patientId, countryCode) {
    const wallet = await ensureWallet(patientId);
    const { displayCurrency, rate } = await getCurrencyInfo(countryCode);

    const conv = (usd) => parseFloat((parseFloat(usd || 0) * rate).toFixed(2));

    return {
      balance:       conv(wallet.balanceUsd),
      totalSpent:    conv(wallet.totalSpentUsd),
      totalTopUps:   conv(wallet.totalTopUpsUsd),
      currency:      displayCurrency,
    };
  },

  /**
   * GET /patient/wallet/transactions
   */
  async getTransactions(patientId, query, countryCode) {
    const wallet = await ensureWallet(patientId);
    const { type, category, page = 1, limit = 20 } = query;
    const safeLimit = Math.min(parseInt(limit) || 20, 100);
    const safePage  = parseInt(page) || 1;

    const { transactions, total } = await patientWalletTxnRepo.findByWallet({
      walletId: wallet.id,
      type,
      category,
      page: safePage,
      limit: safeLimit,
    });

    const { displayCurrency, rate } = await getCurrencyInfo(countryCode);
    const conv = (usd) => parseFloat((parseFloat(usd || 0) * rate).toFixed(2));

    const items = transactions.map(txn => ({
      id:          txn.id,
      type:        txn.type,
      status:      txn.status,
      category:    txn.category,
      amount:      conv(txn.amountUsd),
      currency:    displayCurrency,
      description: txn.description,
      reference:   txn.reference,
      invoiceId:   txn.invoiceId,
      createdAt:   txn.createdAt,
    }));

    return { items, total, page: safePage, limit: safeLimit, currency: displayCurrency };
  },

  /**
   * POST /patient/wallet/top-up
   * Initializes a payment gateway session. Wallet is credited when webhook fires.
   */
  async initiateTopUp(patientId, { amount, paymentMethod }, countryCode) {
    if (!amount || amount <= 0) {
      throw Object.assign(new Error("amount must be a positive number"), { status: 400 });
    }

    const wallet = await ensureWallet(patientId);
    const { displayCurrency, rate } = await getCurrencyInfo(countryCode);

    // Convert requested display-currency amount → USD
    const amountUsd   = parseFloat((amount / rate).toFixed(4));
    const amountLocal = parseFloat(amount);
    const reference   = generateReference();

    // Determine provider
    const { currency, provider } = await resolveCurrency(countryCode);

    let authorizationUrl = null;
    try {
      if (provider === "paystack") {
        authorizationUrl = await _initPaystackTopUp(patientId, amountLocal, currency, reference);
      } else {
        authorizationUrl = await _initFlutterwaveTopUp(patientId, amountLocal, currency, reference);
      }
    } catch (err) {
      console.error("[PatientWallet] Gateway error:", err.message);
      throw Object.assign(new Error("Payment gateway error. Please try again."), { status: 502 });
    }

    // Record pending top-up transaction
    const currentBalance = parseFloat(wallet.balanceUsd || 0);
    await patientWalletTxnRepo.save({
      walletId:        wallet.id,
      patientId,
      type:            PatientTxnType.CREDIT,
      status:          PatientTxnStatus.PENDING,
      category:        PatientTxnCategory.TOP_UP,
      amountUsd,
      balanceAfterUsd: currentBalance + amountUsd,
      description:     `Wallet top-up — ${currency} ${amountLocal}`,
      reference,
      authorizationUrl,
      provider,
    });

    return {
      reference,
      authorizationUrl,
      amount:   amountLocal,
      currency: displayCurrency,
    };
  },

  /**
   * Called by webhook when a top-up payment is confirmed.
   * Finds the pending transaction by reference, credits wallet.
   */
  async handleTopUpSuccess(reference) {
    const txn = await patientWalletTxnRepo.findByReference(reference);
    if (!txn || txn.status !== PatientTxnStatus.PENDING) return;

    // Credit wallet
    await patientWalletRepo.creditBalance(txn.patientId, parseFloat(txn.amountUsd));

    // Mark transaction as completed
    await patientWalletTxnRepo.update(txn.id, {
      status: PatientTxnStatus.COMPLETED,
    });

    console.log(`[PatientWallet] Top-up confirmed for patient ${txn.patientId} — ${txn.amountUsd} USD`);
  },

  /**
   * Called when a top-up payment fails.
   */
  async handleTopUpFailed(reference) {
    const txn = await patientWalletTxnRepo.findByReference(reference);
    if (!txn || txn.status !== PatientTxnStatus.PENDING) return;
    await patientWalletTxnRepo.update(txn.id, { status: PatientTxnStatus.FAILED });
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCurrencyInfo(countryCode) {
  const displayCurrency = CurrencyService.getCurrencyForCountry(countryCode);
  const rates = await CurrencyService.getExchangeRates();
  const rate  = rates[displayCurrency] || 1;
  return { displayCurrency, rate };
}

async function resolveCurrency(countryCode) {
  const currency = CurrencyService.getCurrencyForCountry(countryCode || "US");
  const [flutterwaveOk, paystackOk] = await Promise.all([
    CurrencyService.isCurrencySupportedByProvider(currency, "flutterwave"),
    CurrencyService.isCurrencySupportedByProvider(currency, "paystack"),
  ]);
  if (paystackOk)    return { currency, provider: "paystack" };
  if (flutterwaveOk) return { currency, provider: "flutterwave" };
  return { currency: "USD", provider: "paystack" };
}

async function _initPaystackTopUp(patientId, amountLocal, currency, reference) {
  const amountKobo = Math.round(amountLocal * 100);
  const res = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      amount:    amountKobo,
      currency,
      reference,
      metadata: { type: "wallet_topup", patientId, reference },
    },
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
  );
  return res.data?.data?.authorization_url || null;
}

async function _initFlutterwaveTopUp(patientId, amountLocal, currency, reference) {
  const res = await axios.post(
    "https://api.flutterwave.com/v3/payments",
    {
      tx_ref:      reference,
      amount:      amountLocal,
      currency,
      redirect_url: process.env.PAYMENT_REDIRECT_URL || "http://localhost:3000/payment/callback",
      meta: { type: "wallet_topup", patientId, reference },
      customer: { email: `patient-${patientId}@cosmicforge.internal` },
    },
    { headers: { Authorization: `Bearer ${FLUTTER_SECRET}` } }
  );
  return res.data?.data?.link || null;
}

module.exports = patientWalletService;
