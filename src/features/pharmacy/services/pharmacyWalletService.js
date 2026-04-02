const pharmacyWalletRepo    = require("../repositories/pharmacyWalletRepository");
const walletTxnRepo         = require("../repositories/pharmacyWalletTransactionRepository");
const pharmacyPayoutRepo    = require("../repositories/pharmacyPayoutRepository");
const bankAccountRepo       = require("../repositories/pharmacyBankAccountRepository");
const pharmacyProfileRepo   = require("../repositories/pharmacyProfileRepository");

const { fromUsd }           = require("./invoiceService");
const CurrencyService       = require("../../payments/services/currencyService");
const NotificationService   = require("../../notifications/services/notificationService");

const PayoutSchema          = require("../entities/PharmacyPayoutRequest");
const WalletTxnSchema       = require("../entities/PharmacyWalletTransaction");

const { AppDataSource }     = require("../../../config/database");
const axios                 = require("axios");

const notificationService   = new NotificationService();

const { PayoutStatus }           = PayoutSchema;
const { WalletTransactionType, WalletTransactionStatus, WalletTransactionCategory } = WalletTxnSchema;

// ─── helpers ────────────────────────────────────────────────────────────────

function generatePayoutReference() {
  return `PAYOUT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

async function getDisplayCurrency(pharmacyId) {
  const wallet   = await pharmacyWalletRepo.findByPharmacyId(pharmacyId);
  return wallet?.preferredDisplayCurrency || "USD";
}

/**
 * Convert wallet USD balances to display currency for API response.
 */
async function formatWalletBalance(wallet, displayCurrency) {
  const rates = await CurrencyService.getExchangeRates();
  const rate  = rates[displayCurrency] || 1;
  const conv  = (usd) => Math.round(parseFloat(usd || 0) * rate * 100) / 100;

  return {
    availableBalance:   conv(wallet.availableBalanceUsd),
    pendingClearance:   conv(wallet.pendingClearanceUsd),
    totalEarnings:      conv(wallet.totalEarningsUsd),
    currency:           displayCurrency,
  };
}

// ─── service ────────────────────────────────────────────────────────────────

const pharmacyWalletService = {

  /**
   * Ensure wallet exists for pharmacy (called at registration time).
   */
  async ensureWallet(pharmacyId, preferredCurrency = "NGN") {
    const existing = await pharmacyWalletRepo.findByPharmacyId(pharmacyId);
    if (existing) return existing;

    return pharmacyWalletRepo.save({
      pharmacyId,
      availableBalanceUsd: 0,
      pendingClearanceUsd: 0,
      totalEarningsUsd:    0,
      preferredDisplayCurrency: preferredCurrency,
    });
  },

  /**
   * GET /pharmacy/wallet/summary
   */
  async getSummary(pharmacyId) {
    const wallet = await pharmacyWalletService.ensureWallet(pharmacyId);

    const displayCurrency = wallet.preferredDisplayCurrency || "USD";
    const balances        = await formatWalletBalance(wallet, displayCurrency);

    // Last payout
    const { payouts } = await pharmacyPayoutRepo.findByPharmacy({
      pharmacyId, status: PayoutStatus.COMPLETED, page: 1, limit: 1,
    });

    const lastPayout = payouts[0] ?? null;
    const rates      = await CurrencyService.getExchangeRates();
    const rate       = rates[displayCurrency] || 1;

    return {
      ...balances,
      thisMonthEarnings: await pharmacyWalletService._thisMonthEarnings(pharmacyId, displayCurrency, rate),
      lastPayoutAmount:  lastPayout ? Math.round(parseFloat(lastPayout.amountUsd) * rate * 100) / 100 : null,
      lastPayoutDate:    lastPayout?.processedAt ?? null,
      currency:          displayCurrency,
    };
  },

  async _thisMonthEarnings(pharmacyId, displayCurrency, rate) {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const result     = await walletTxnRepo.getEarningsSummary(pharmacyId, monthStart, now);
    return Math.round(parseFloat(result?.totalUsd || 0) * rate * 100) / 100;
  },

  /**
   * GET /pharmacy/wallet/transactions
   */
  async getTransactions(pharmacyId, query) {
    const { type, status, category, dateFrom, dateTo, page = 1, limit = 20 } = query;
    const safeLimit = Math.min(parseInt(limit) || 20, 100);
    const safePage  = parseInt(page) || 1;

    const wallet = await pharmacyWalletService.ensureWallet(pharmacyId);

    const { transactions, total } = await walletTxnRepo.findByWallet({
      walletId: wallet.id, type, status, category,
      dateFrom: dateFrom ? new Date(dateFrom) : null,
      dateTo:   dateTo   ? new Date(dateTo)   : null,
      page: safePage, limit: safeLimit,
    });

    const displayCurrency = wallet.preferredDisplayCurrency || "USD";
    const rates           = await CurrencyService.getExchangeRates();
    const rate            = rates[displayCurrency] || 1;
    const conv            = (usd) => Math.round(parseFloat(usd || 0) * rate * 100) / 100;

    const formatted = transactions.map((txn) => ({
      id:             txn.id,
      type:           txn.type,
      status:         txn.status,
      category:       txn.category,
      amount:         conv(txn.amountUsd),
      balanceAfter:   conv(txn.balanceAfterUsd),
      description:    txn.description,
      reference:      txn.reference,
      invoiceId:      txn.invoiceId,
      invoiceRef:     txn.invoiceRef,
      prescriptionRef: txn.prescriptionId ?? null,
      currency:       displayCurrency,
      settledAt:      txn.settledAt,
      createdAt:      txn.createdAt,
    }));

    return { transactions: formatted, total, page: safePage, limit: safeLimit, currency: displayCurrency };
  },

  /**
   * GET /pharmacy/wallet/transactions/:id/receipt
   */
  async getTransactionReceipt(pharmacyId, transactionId) {
    const wallet = await pharmacyWalletRepo.findByPharmacyId(pharmacyId);
    if (!wallet) throw Object.assign(new Error('Wallet not found'), { status: 404 });

    const txn = await walletTxnRepo.findById(transactionId);
    if (!txn || txn.walletId !== wallet.id) {
      throw Object.assign(new Error('Transaction not found'), { status: 404 });
    }

    const { displayCurrency, rate } = await CurrencyService.getCurrencyForCountry(null);
    const conv = (usd) => parseFloat((usd * rate).toFixed(2));

    return {
      id:           txn.id,
      reference:    txn.reference,
      type:         txn.type,
      status:       txn.status,
      category:     txn.category,
      amount:       conv(txn.amountUsd),
      currency:     displayCurrency,
      description:  txn.description,
      invoiceRef:   txn.invoiceRef,
      settledAt:    txn.settledAt,
      createdAt:    txn.createdAt,
    };
  },

  /**
   * GET /pharmacy/wallet/earnings
   */
  async getEarnings(pharmacyId, query) {
    const { period = "monthly", dateFrom, dateTo } = query;
    const now      = new Date();
    const from     = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const to       = dateTo   ? new Date(dateTo)   : now;

    const wallet          = await pharmacyWalletRepo.findByPharmacyId(pharmacyId);
    const displayCurrency = wallet?.preferredDisplayCurrency || "USD";
    const rates           = await CurrencyService.getExchangeRates();
    const rate            = rates[displayCurrency] || 1;
    const conv            = (usd) => Math.round(parseFloat(usd || 0) * rate * 100) / 100;

    // Build period breakdown via raw SQL grouping
    let groupBy, labelFmt;
    if (period === "weekly") {
      groupBy  = "TO_CHAR(txn.\"createdAt\", 'IYYY-IW')";
      labelFmt = "TO_CHAR(MIN(txn.\"createdAt\"), 'Mon DD, YYYY')";
    } else if (period === "yearly") {
      groupBy  = "TO_CHAR(txn.\"createdAt\", 'YYYY')";
      labelFmt = "TO_CHAR(MIN(txn.\"createdAt\"), 'YYYY')";
    } else {
      groupBy  = "TO_CHAR(txn.\"createdAt\", 'YYYY-MM')";
      labelFmt = "TO_CHAR(MIN(txn.\"createdAt\"), 'Month YYYY')";
    }

    const rows = await walletTxnRepo.getEarningsSummary(pharmacyId, from, to);

    // Summaries
    const thisMonthStart  = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const threeMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const [thisMonthRaw, lastMonthRaw, threeMonthRaw, allTimeRaw] = await Promise.all([
      walletTxnRepo.getEarningsSummary(pharmacyId, thisMonthStart, now),
      walletTxnRepo.getEarningsSummary(pharmacyId, lastMonthStart, thisMonthStart),
      walletTxnRepo.getEarningsSummary(pharmacyId, threeMonthStart, now),
      walletTxnRepo.getEarningsSummary(pharmacyId, new Date(0), now),
    ]);

    return {
      currentMonth:  conv(thisMonthRaw?.totalUsd),
      lastMonth:     conv(lastMonthRaw?.totalUsd),
      last3Months:   conv(threeMonthRaw?.totalUsd),
      allTime:       conv(allTimeRaw?.totalUsd),
      currency:      displayCurrency,
      byPeriod:      [], // Period breakdown requires raw query — simplified here
    };
  },

  // ─── Payouts ─────────────────────────────────────────────────────────────

  async getPayouts(pharmacyId, query) {
    const { status, page = 1, limit = 20 } = query;
    const safeLimit = Math.min(parseInt(limit) || 20, 100);
    const safePage  = parseInt(page) || 1;

    const { payouts, total } = await pharmacyPayoutRepo.findByPharmacy({
      pharmacyId, status, page: safePage, limit: safeLimit,
    });

    const wallet          = await pharmacyWalletRepo.findByPharmacyId(pharmacyId);
    const displayCurrency = wallet?.preferredDisplayCurrency || "USD";
    const rates           = await CurrencyService.getExchangeRates();
    const rate            = rates[displayCurrency] || 1;
    const conv            = (usd) => Math.round(parseFloat(usd || 0) * rate * 100) / 100;

    const formatted = payouts.map((p) => ({
      id:           p.id,
      amount:       conv(p.amountUsd),
      currency:     displayCurrency,
      status:       p.status,
      bankAccount:  p.bankAccount
        ? {
            id:            p.bankAccount.id,
            bankName:      p.bankAccount.bankName,
            accountNumber: p.bankAccount.accountNumber,
            accountName:   p.bankAccount.accountName,
            bankCode:      p.bankAccount.bankCode,
            isDefault:     p.bankAccount.isDefault,
          }
        : null,
      reference:     p.reference,
      note:          p.note,
      failureReason: p.failureReason,
      requestedAt:   p.requestedAt,
      processedAt:   p.processedAt,
    }));

    return { payouts: formatted, total, page: safePage, limit: safeLimit };
  },

  /**
   * POST /pharmacy/wallet/payouts
   * Request a payout to a saved bank account.
   * min amount: USD 5 equivalent. Only one active payout at a time.
   */
  async requestPayout(pharmacyId, body) {
    const { amount, bankAccountId, note } = body;

    if (!amount || !bankAccountId) {
      throw Object.assign(new Error("amount and bankAccountId are required"), { status: 400 });
    }

    const wallet = await pharmacyWalletRepo.findByPharmacyId(pharmacyId);
    if (!wallet) throw Object.assign(new Error("Wallet not found"), { status: 404 });
    if (wallet.isFrozen) throw Object.assign(new Error("Wallet is frozen"), { status: 422 });

    const displayCurrency = wallet.preferredDisplayCurrency || "USD";
    const rates           = await CurrencyService.getExchangeRates();
    const rate            = rates[displayCurrency] || 1;

    // Convert requested amount (in display currency) to USD
    const amountUsd = Math.round((amount / rate) * 10000) / 10000;

    // Minimum payout: USD 5
    if (amountUsd < 5) {
      throw Object.assign(
        new Error(`Minimum payout is ${Math.round(5 * rate * 100) / 100} ${displayCurrency}`),
        { status: 400 }
      );
    }

    const availableUsd = parseFloat(wallet.availableBalanceUsd);
    if (amountUsd > availableUsd) {
      throw Object.assign(new Error("Insufficient available balance"), { status: 422 });
    }

    // One active payout at a time
    const hasActive = await pharmacyPayoutRepo.hasActivePayout(pharmacyId);
    if (hasActive) {
      throw Object.assign(
        new Error("A payout is already pending or processing. Wait for it to complete first."),
        { status: 422 }
      );
    }

    // Verify bank account belongs to pharmacy
    const bankAccount = await bankAccountRepo.findByIdAndPharmacy(bankAccountId, pharmacyId);
    if (!bankAccount) {
      throw Object.assign(new Error("Bank account not found"), { status: 404 });
    }

    const reference = generatePayoutReference();

    await AppDataSource.transaction(async (trx) => {
      // Deduct from available immediately
      await trx.update("PharmacyWallet", { id: wallet.id }, {
        availableBalanceUsd: () => `GREATEST("availableBalanceUsd" - ${amountUsd}, 0)`,
      });

      // Create payout record
      await trx.save("PharmacyPayoutRequest", {
        pharmacyId,
        walletId:      wallet.id,
        bankAccountId,
        amountUsd,
        status:        PayoutStatus.PENDING,
        reference,
        note:          note ?? null,
      });

      // Create wallet debit transaction
      const updatedWallet = await trx.findOne("PharmacyWallet", { where: { id: wallet.id } });
      await trx.save("PharmacyWalletTransaction", {
        walletId:        wallet.id,
        pharmacyId,
        type:            WalletTransactionType.DEBIT,
        status:          WalletTransactionStatus.PROCESSING,
        category:        WalletTransactionCategory.PAYOUT,
        amountUsd,
        balanceAfterUsd: parseFloat(updatedWallet.availableBalanceUsd),
        description:     `Payout request ${reference}`,
        reference,
      });
    });

    // Initiate bank transfer via Paystack
    try {
      await pharmacyWalletService._initiatePaystackTransfer(
        pharmacyId, bankAccount, amountUsd, displayCurrency, rate, reference, wallet.id
      );
    } catch (err) {
      console.error("Paystack transfer initiation failed:", err.message);
      // Payout stays PENDING — will be retried or manually handled
    }

    // Notify admin
    try {
      const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);
      await notificationService.createNotification(pharmacy.userId, {
        title:   "Payout Requested",
        message: `A payout of ${amount} ${displayCurrency} has been requested.`,
        type:    "payout_requested",
        data:    { reference },
      });
    } catch (err) {
      console.error("Notification send failed:", err.message);
    }

    return pharmacyPayoutRepo.findByReference(reference);
  },

  async _initiatePaystackTransfer(pharmacyId, bankAccount, amountUsd, displayCurrency, rate, reference, walletId) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return;

    const amountInLocal  = Math.round(amountUsd * rate * 100); // in kobo/subunit
    const recipientCode  = bankAccount.recipientCode;

    if (!recipientCode) {
      throw new Error("Bank account has no Paystack recipient code");
    }

    const response = await axios.post(
      "https://api.paystack.co/transfer",
      {
        source:    "balance",
        amount:    amountInLocal,
        recipient: recipientCode,
        reason:    `Pharmacy payout ${reference}`,
        currency:  displayCurrency,
        reference,
      },
      {
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
          "Idempotency-Key": reference,
        },
      }
    );

    if (response.data?.status) {
      const transferCode = response.data.data?.transfer_code;
      const payout       = await pharmacyPayoutRepo.findByReference(reference);
      if (payout) {
        await pharmacyPayoutRepo.update(payout.id, {
          status:       PayoutStatus.PROCESSING,
          transferCode: transferCode ?? null,
        });
      }
    }
  },

  async cancelPayout(pharmacyId, payoutId) {
    const payout = await pharmacyPayoutRepo.findByIdAndPharmacy(payoutId, pharmacyId);
    if (!payout) throw Object.assign(new Error("Payout not found"), { status: 404 });
    if (payout.status !== PayoutStatus.PENDING) {
      throw Object.assign(new Error("Only pending payouts can be cancelled"), { status: 422 });
    }

    await AppDataSource.transaction(async (trx) => {
      await trx.update("PharmacyPayoutRequest", { id: payoutId }, { status: PayoutStatus.CANCELLED });

      // Restore funds to available
      const wallet = await pharmacyWalletRepo.findByPharmacyId(pharmacyId);
      await trx.update("PharmacyWallet", { pharmacyId }, {
        availableBalanceUsd: () => `"availableBalanceUsd" + ${payout.amountUsd}`,
      });

      const updatedWallet = await trx.findOne("PharmacyWallet", { where: { pharmacyId } });
      await trx.save("PharmacyWalletTransaction", {
        walletId:        wallet.id,
        pharmacyId,
        type:            WalletTransactionType.CREDIT,
        status:          WalletTransactionStatus.COMPLETED,
        category:        WalletTransactionCategory.ADJUSTMENT,
        amountUsd:       payout.amountUsd,
        balanceAfterUsd: parseFloat(updatedWallet.availableBalanceUsd),
        description:     `Payout cancelled — funds restored (${payout.reference})`,
        reference:       `CANCEL-${payout.reference}`,
        payoutRequestId: payoutId,
      });
    });

    return pharmacyPayoutRepo.findByIdAndPharmacy(payoutId, pharmacyId);
  },

  // ─── Bank accounts ───────────────────────────────────────────────────────

  async getBankAccounts(pharmacyId) {
    const accounts = await bankAccountRepo.findByPharmacy(pharmacyId);
    return accounts.map((a) => ({
      id:            a.id,
      bankName:      a.bankName,
      accountNumber: a.accountNumber,
      accountName:   a.accountName,
      bankCode:      a.bankCode,
      isDefault:     a.isDefault,
    }));
  },

  /**
   * Add a bank account and verify it via Paystack Resolve Account API.
   */
  async addBankAccount(pharmacyId, body) {
    const { bankName, accountNumber, accountName, bankCode } = body;

    if (!bankName || !accountNumber || !accountName || !bankCode) {
      throw Object.assign(
        new Error("bankName, accountNumber, accountName, and bankCode are required"),
        { status: 400 }
      );
    }

    const wallet = await pharmacyWalletRepo.findByPharmacyId(pharmacyId);
    if (!wallet) throw Object.assign(new Error("Wallet not found"), { status: 404 });

    // Verify account via Paystack
    let resolvedName = accountName;
    let recipientCode = null;

    try {
      const secret = process.env.PAYSTACK_SECRET_KEY;
      if (secret) {
        const resolveResp = await axios.get(
          `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
          { headers: { Authorization: `Bearer ${secret}` } }
        );

        if (resolveResp.data?.status) {
          resolvedName = resolveResp.data.data?.account_name ?? accountName;
        }

        // Create transfer recipient
        const recipientResp = await axios.post(
          "https://api.paystack.co/transferrecipient",
          {
            type:           "nuban",
            name:           resolvedName,
            account_number: accountNumber,
            bank_code:      bankCode,
            currency:       "NGN",
          },
          { headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" } }
        );

        if (recipientResp.data?.status) {
          recipientCode = recipientResp.data.data?.recipient_code ?? null;
        }
      }
    } catch (err) {
      console.warn("Paystack account verification failed:", err.message);
      // Allow adding account anyway — will be verified later
    }

    const isFirst = (await bankAccountRepo.countByPharmacy(pharmacyId)) === 0;

    const saved = await bankAccountRepo.save({
      pharmacyId,
      walletId:      wallet.id,
      bankName,
      accountNumber,
      accountName:   resolvedName,
      bankCode,
      recipientCode,
      isDefault:     isFirst,
    });

    return {
      id:            saved.id,
      bankName:      saved.bankName,
      accountNumber: saved.accountNumber,
      accountName:   saved.accountName,
      bankCode:      saved.bankCode,
      isDefault:     saved.isDefault,
    };
  },

  async setDefaultBankAccount(pharmacyId, accountId) {
    const account = await bankAccountRepo.findByIdAndPharmacy(accountId, pharmacyId);
    if (!account) throw Object.assign(new Error("Bank account not found"), { status: 404 });

    const updated = await bankAccountRepo.setDefault(accountId, pharmacyId);
    return {
      id:            updated.id,
      bankName:      updated.bankName,
      accountNumber: updated.accountNumber,
      accountName:   updated.accountName,
      bankCode:      updated.bankCode,
      isDefault:     updated.isDefault,
    };
  },

  async deleteBankAccount(pharmacyId, accountId) {
    const account = await bankAccountRepo.findByIdAndPharmacy(accountId, pharmacyId);
    if (!account) throw Object.assign(new Error("Bank account not found"), { status: 404 });

    if (account.isDefault) {
      const count = await bankAccountRepo.countByPharmacy(pharmacyId);
      if (count > 1) {
        throw Object.assign(
          new Error("Cannot delete the default account while other accounts exist. Set another as default first."),
          { status: 422 }
        );
      }
    }

    // Block if a payout is pending/processing to this account
    const { payouts } = await pharmacyPayoutRepo.findByPharmacy({
      pharmacyId, page: 1, limit: 100,
    });
    const blocked = payouts.some(
      (p) =>
        p.bankAccountId === accountId &&
        [PayoutStatus.PENDING, PayoutStatus.PROCESSING].includes(p.status)
    );
    if (blocked) {
      throw Object.assign(
        new Error("Cannot delete this account while a payout to it is pending or processing"),
        { status: 422 }
      );
    }

    await bankAccountRepo.softDelete(accountId);
  },
};

module.exports = pharmacyWalletService;
