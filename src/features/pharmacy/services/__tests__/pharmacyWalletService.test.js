/* eslint-env jest */
// Unit tests for pharmacyWalletService — pharmacy-side wallet balances, payouts,
// and bank accounts. All money is stored in USD on PharmacyWallet /
// PharmacyWalletTransaction / PharmacyPayoutRequest and converted to the
// pharmacy's preferred display currency only at the API boundary.
//
// Focus areas: currency conversion/rounding correctness, payout guardrails
// (minimum amount, insufficient balance, one-active-payout-at-a-time,
// frozen wallet), and that the payout/cancel transactions write consistent
// amounts across the wallet balance and the transaction ledger row.

jest.mock('../../../../config/database');
jest.mock('../../repositories/pharmacyWalletRepository');
jest.mock('../../repositories/pharmacyWalletTransactionRepository');
jest.mock('../../repositories/pharmacyPayoutRepository');
jest.mock('../../repositories/pharmacyBankAccountRepository');
jest.mock('../../repositories/pharmacyProfileRepository');
jest.mock('../../../payments/services/currencyService');
jest.mock('../../../notifications/services/notificationService');
jest.mock('axios');

const AppDataSource     = require('../../../../config/database');
const pharmacyWalletRepo = require('../../repositories/pharmacyWalletRepository');
const walletTxnRepo      = require('../../repositories/pharmacyWalletTransactionRepository');
const pharmacyPayoutRepo = require('../../repositories/pharmacyPayoutRepository');
const bankAccountRepo    = require('../../repositories/pharmacyBankAccountRepository');
const pharmacyProfileRepo = require('../../repositories/pharmacyProfileRepository');
const CurrencyService    = require('../../../payments/services/currencyService');
const NotificationService = require('../../../notifications/services/notificationService');
const axios = require('axios');

const pharmacyWalletService = require('../pharmacyWalletService');

const PHARMACY_ID = 'aaaa0000-0000-0000-0000-000000000001';
const WALLET_ID   = 'bbbb0000-0000-0000-0000-000000000002';

function makeWallet(overrides = {}) {
  return {
    id: WALLET_ID,
    pharmacyId: PHARMACY_ID,
    availableBalanceUsd: '100.0000',
    pendingClearanceUsd: '0.0000',
    totalEarningsUsd: '500.0000',
    preferredDisplayCurrency: 'USD',
    isFrozen: false,
    ...overrides,
  };
}

function makeFakeTrx() {
  const calls = { update: [], save: [], findOne: [] };
  return {
    update: jest.fn(async (entity, criteria, values) => {
      calls.update.push({ entity, criteria, values });
    }),
    save: jest.fn(async (entity, data) => {
      calls.save.push({ entity, data });
      return { id: 'saved-id', ...data };
    }),
    findOne: jest.fn(async (entity, opts) => {
      calls.findOne.push({ entity, opts });
      // Default: return wallet with balance updated per test override
      return makeWallet();
    }),
    __calls: calls,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  let lastTrx;
  AppDataSource.transaction = jest.fn(async (cb) => {
    lastTrx = makeFakeTrx();
    await cb(lastTrx);
    return lastTrx;
  });
  AppDataSource.__getLastTrx = () => lastTrx;

  pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(makeWallet());
  pharmacyWalletRepo.save = jest.fn().mockImplementation(async (data) => ({ id: WALLET_ID, ...data }));

  walletTxnRepo.getEarningsSummary = jest.fn().mockResolvedValue({ totalUsd: '0' });
  walletTxnRepo.findByWallet = jest.fn().mockResolvedValue({ transactions: [], total: 0 });
  walletTxnRepo.findById = jest.fn().mockResolvedValue(null);

  pharmacyPayoutRepo.findByPharmacy = jest.fn().mockResolvedValue({ payouts: [], total: 0 });
  pharmacyPayoutRepo.hasActivePayout = jest.fn().mockResolvedValue(false);
  pharmacyPayoutRepo.findByReference = jest.fn().mockResolvedValue({ id: 'payout-1', status: 'pending' });
  pharmacyPayoutRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(null);
  pharmacyPayoutRepo.update = jest.fn().mockResolvedValue(undefined);

  bankAccountRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(null);
  bankAccountRepo.findByPharmacy = jest.fn().mockResolvedValue([]);
  bankAccountRepo.countByPharmacy = jest.fn().mockResolvedValue(0);
  bankAccountRepo.save = jest.fn().mockImplementation(async (data) => ({ id: 'bank-1', ...data }));
  bankAccountRepo.setDefault = jest.fn().mockResolvedValue(null);
  bankAccountRepo.softDelete = jest.fn().mockResolvedValue(undefined);

  pharmacyProfileRepo.findById = jest.fn().mockResolvedValue({
    id: PHARMACY_ID, userId: 'user-1', defaultCurrency: 'NGN',
  });

  CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1, NGN: 1500 });

  NotificationService.prototype.createNotification = jest.fn().mockResolvedValue(undefined);

  axios.post = jest.fn().mockResolvedValue({ data: { status: false } });
  axios.get  = jest.fn().mockResolvedValue({ data: { status: false } });

  delete process.env.PAYSTACK_SECRET_KEY;
});

// ============================================================================
// ensureWallet
// ============================================================================

describe('ensureWallet', () => {
  test('returns existing wallet without creating a new one', async () => {
    const existing = makeWallet();
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(existing);

    const result = await pharmacyWalletService.ensureWallet(PHARMACY_ID);

    expect(result).toBe(existing);
    expect(pharmacyWalletRepo.save).not.toHaveBeenCalled();
  });

  test('creates a wallet with caller-supplied currency when none exists', async () => {
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(null);

    await pharmacyWalletService.ensureWallet(PHARMACY_ID, 'GBP');

    expect(pharmacyWalletRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        pharmacyId: PHARMACY_ID,
        availableBalanceUsd: 0,
        pendingClearanceUsd: 0,
        totalEarningsUsd: 0,
        preferredDisplayCurrency: 'GBP',
      })
    );
  });

  test('falls back to pharmacy.defaultCurrency, then NGN, when no currency supplied', async () => {
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(null);
    pharmacyProfileRepo.findById = jest.fn().mockResolvedValue({ id: PHARMACY_ID, defaultCurrency: 'GHS' });

    await pharmacyWalletService.ensureWallet(PHARMACY_ID);
    expect(pharmacyWalletRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ preferredDisplayCurrency: 'GHS' })
    );

    pharmacyProfileRepo.findById = jest.fn().mockResolvedValue(null);
    await pharmacyWalletService.ensureWallet(PHARMACY_ID);
    expect(pharmacyWalletRepo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ preferredDisplayCurrency: 'NGN' })
    );
  });
});

// ============================================================================
// getSummary — currency conversion correctness
// ============================================================================

describe('getSummary', () => {
  test('converts USD balances to the wallet display currency using the live rate', async () => {
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(
      makeWallet({ availableBalanceUsd: '10.0000', preferredDisplayCurrency: 'NGN' })
    );
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ NGN: 1500 });

    const result = await pharmacyWalletService.getSummary(PHARMACY_ID);

    expect(result.availableBalance).toBe(15000); // 10 USD * 1500
    expect(result.currency).toBe('NGN');
  });

  test('reports the last completed payout amount converted to display currency', async () => {
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(makeWallet({ preferredDisplayCurrency: 'NGN' }));
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ NGN: 1500 });
    pharmacyPayoutRepo.findByPharmacy = jest.fn().mockResolvedValue({
      payouts: [{ amountUsd: '2.5000', processedAt: '2026-01-01T00:00:00Z' }],
      total: 1,
    });

    const result = await pharmacyWalletService.getSummary(PHARMACY_ID);

    expect(result.lastPayoutAmount).toBe(3750); // 2.5 * 1500
    expect(result.lastPayoutDate).toBe('2026-01-01T00:00:00Z');
  });

  test('reports null last payout when none exist', async () => {
    pharmacyPayoutRepo.findByPharmacy = jest.fn().mockResolvedValue({ payouts: [], total: 0 });
    const result = await pharmacyWalletService.getSummary(PHARMACY_ID);
    expect(result.lastPayoutAmount).toBeNull();
    expect(result.lastPayoutDate).toBeNull();
  });
});

// ============================================================================
// getTransactions
// ============================================================================

describe('getTransactions', () => {
  test('caps limit at 100 and defaults page/limit', async () => {
    await pharmacyWalletService.getTransactions(PHARMACY_ID, { limit: 500 });

    expect(walletTxnRepo.findByWallet).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100, page: 1 })
    );
  });

  test('converts each transaction amount and balanceAfter to display currency', async () => {
    walletTxnRepo.findByWallet = jest.fn().mockResolvedValue({
      transactions: [
        { id: 't1', type: 'credit', status: 'completed', category: 'invoice_payment', amountUsd: '2.0000', balanceAfterUsd: '10.0000' },
      ],
      total: 1,
    });
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1, NGN: 1500 });
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(makeWallet({ preferredDisplayCurrency: 'NGN' }));

    const result = await pharmacyWalletService.getTransactions(PHARMACY_ID, {});

    expect(result.transactions[0].amount).toBe(3000);
    expect(result.transactions[0].balanceAfter).toBe(15000);
    expect(result.currency).toBe('NGN');
  });
});

// ============================================================================
// getTransactionReceipt
// ============================================================================

describe('getTransactionReceipt', () => {
  test('throws 404 when the wallet does not exist', async () => {
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(null);
    await expect(pharmacyWalletService.getTransactionReceipt(PHARMACY_ID, 'txn-1'))
      .rejects.toMatchObject({ message: 'Wallet not found', status: 404 });
  });

  test('throws 404 when the transaction does not belong to this pharmacy wallet', async () => {
    walletTxnRepo.findById = jest.fn().mockResolvedValue({ id: 'txn-1', walletId: 'someone-elses-wallet' });
    await expect(pharmacyWalletService.getTransactionReceipt(PHARMACY_ID, 'txn-1'))
      .rejects.toMatchObject({ message: 'Transaction not found', status: 404 });
  });

  test('returns a converted receipt for a transaction that does belong to this wallet', async () => {
    walletTxnRepo.findById = jest.fn().mockResolvedValue({
      id: 'txn-1', walletId: WALLET_ID, type: 'debit', status: 'completed', category: 'payout', amountUsd: '5.0000',
    });
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1 });

    const result = await pharmacyWalletService.getTransactionReceipt(PHARMACY_ID, 'txn-1');
    expect(result.amount).toBe(5);
  });
});

// ============================================================================
// requestPayout — the highest-risk money path in this service
// ============================================================================

describe('requestPayout', () => {
  const VALID_BODY = { amount: 100, bankAccountId: 'bank-1', note: 'monthly payout' };

  beforeEach(() => {
    bankAccountRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue({ id: 'bank-1', recipientCode: 'RCP_1' });
  });

  test('rejects with 400 when amount or bankAccountId is missing', async () => {
    await expect(pharmacyWalletService.requestPayout(PHARMACY_ID, { amount: 100 }))
      .rejects.toMatchObject({ status: 400 });
    await expect(pharmacyWalletService.requestPayout(PHARMACY_ID, { bankAccountId: 'b1' }))
      .rejects.toMatchObject({ status: 400 });
  });

  test('rejects with 404 when the wallet does not exist', async () => {
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(null);
    await expect(pharmacyWalletService.requestPayout(PHARMACY_ID, VALID_BODY))
      .rejects.toMatchObject({ status: 404 });
  });

  test('rejects with 422 when the wallet is frozen', async () => {
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(makeWallet({ isFrozen: true }));
    await expect(pharmacyWalletService.requestPayout(PHARMACY_ID, VALID_BODY))
      .rejects.toMatchObject({ status: 422, message: 'Wallet is frozen' });
  });

  test('rejects with 400 when the requested amount converts to below the USD 5 minimum', async () => {
    // wallet display currency NGN, rate 1500 => min payout is 7500 NGN
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(
      makeWallet({ preferredDisplayCurrency: 'NGN', availableBalanceUsd: '1000.0000' })
    );
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ NGN: 1500 });

    await expect(pharmacyWalletService.requestPayout(PHARMACY_ID, { amount: 100, bankAccountId: 'bank-1' }))
      .rejects.toMatchObject({ status: 400, message: 'Minimum payout is 7500 NGN' });
  });

  test('rejects with 422 when requested amount exceeds available balance', async () => {
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(
      makeWallet({ preferredDisplayCurrency: 'USD', availableBalanceUsd: '10.0000' })
    );
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1 });

    await expect(pharmacyWalletService.requestPayout(PHARMACY_ID, { amount: 50, bankAccountId: 'bank-1' }))
      .rejects.toMatchObject({ status: 422, message: 'Insufficient available balance' });
  });

  test('rejects with 422 when a payout is already active', async () => {
    pharmacyPayoutRepo.hasActivePayout = jest.fn().mockResolvedValue(true);
    await expect(pharmacyWalletService.requestPayout(PHARMACY_ID, VALID_BODY))
      .rejects.toMatchObject({ status: 422 });
  });

  test('rejects with 404 when the bank account does not belong to this pharmacy', async () => {
    bankAccountRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(null);
    await expect(pharmacyWalletService.requestPayout(PHARMACY_ID, VALID_BODY))
      .rejects.toMatchObject({ status: 404, message: 'Bank account not found' });
  });

  test('deducts the exact USD amount from available balance and creates a PENDING payout + PROCESSING ledger row', async () => {
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(
      makeWallet({ preferredDisplayCurrency: 'USD', availableBalanceUsd: '100.0000' })
    );
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1 });

    await pharmacyWalletService.requestPayout(PHARMACY_ID, { amount: 40, bankAccountId: 'bank-1' });

    const trx = AppDataSource.__getLastTrx();
    expect(trx.__calls.update[0]).toMatchObject({
      entity: 'PharmacyWallet',
      criteria: { id: WALLET_ID },
    });
    expect(trx.__calls.update[0].values.availableBalanceUsd()).toBe(
      'GREATEST("availableBalanceUsd" - 40, 0)'
    );

    const payoutSave = trx.__calls.save.find((c) => c.entity === 'PharmacyPayoutRequest');
    expect(payoutSave.data).toMatchObject({
      pharmacyId: PHARMACY_ID,
      walletId: WALLET_ID,
      bankAccountId: 'bank-1',
      amountUsd: 40,
      status: 'pending',
    });

    const txnSave = trx.__calls.save.find((c) => c.entity === 'PharmacyWalletTransaction');
    expect(txnSave.data).toMatchObject({
      type: 'debit',
      status: 'processing',
      category: 'payout',
      amountUsd: 40,
    });
  });

  test('converts a display-currency amount to USD using the live rate before storing', async () => {
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(
      makeWallet({ preferredDisplayCurrency: 'NGN', availableBalanceUsd: '1000.0000' })
    );
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ NGN: 1500 });

    // 150000 NGN / 1500 = 100 USD
    await pharmacyWalletService.requestPayout(PHARMACY_ID, { amount: 150000, bankAccountId: 'bank-1' });

    const trx = AppDataSource.__getLastTrx();
    const payoutSave = trx.__calls.save.find((c) => c.entity === 'PharmacyPayoutRequest');
    expect(payoutSave.data.amountUsd).toBe(100);
  });

  test('a failed Paystack transfer initiation does not roll back the already-committed payout', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_123';
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(
      makeWallet({ preferredDisplayCurrency: 'USD', availableBalanceUsd: '100.0000' })
    );
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1 });
    axios.post = jest.fn().mockRejectedValue(new Error('Paystack down'));

    await expect(
      pharmacyWalletService.requestPayout(PHARMACY_ID, { amount: 40, bankAccountId: 'bank-1' })
    ).resolves.toBeDefined();

    // Transaction already committed regardless of the Paystack call outcome.
    const trx = AppDataSource.__getLastTrx();
    expect(trx.__calls.save.some((c) => c.entity === 'PharmacyPayoutRequest')).toBe(true);
  });

  test('a notification failure does not prevent the payout from succeeding', async () => {
    pharmacyProfileRepo.findById = jest.fn().mockRejectedValue(new Error('profile lookup failed'));
    await expect(
      pharmacyWalletService.requestPayout(PHARMACY_ID, { amount: 40, bankAccountId: 'bank-1' })
    ).resolves.toBeDefined();
  });
});

// ============================================================================
// cancelPayout
// ============================================================================

describe('cancelPayout', () => {
  test('throws 404 when the payout does not belong to this pharmacy', async () => {
    pharmacyPayoutRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(null);
    await expect(pharmacyWalletService.cancelPayout(PHARMACY_ID, 'payout-1'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('throws 422 when the payout is not pending', async () => {
    pharmacyPayoutRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue({ id: 'payout-1', status: 'processing' });
    await expect(pharmacyWalletService.cancelPayout(PHARMACY_ID, 'payout-1'))
      .rejects.toMatchObject({ status: 422, message: 'Only pending payouts can be cancelled' });
  });

  test('restores the exact payout amount to available balance and logs a CREDIT/COMPLETED ledger row', async () => {
    pharmacyPayoutRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue({
      id: 'payout-1', status: 'pending', amountUsd: '40.0000', reference: 'PAYOUT-123',
    });

    await pharmacyWalletService.cancelPayout(PHARMACY_ID, 'payout-1');

    const trx = AppDataSource.__getLastTrx();
    expect(trx.__calls.update[0]).toMatchObject({
      entity: 'PharmacyPayoutRequest',
      criteria: { id: 'payout-1' },
      values: { status: 'cancelled' },
    });
    expect(trx.__calls.update[1].values.availableBalanceUsd()).toBe(
      '"availableBalanceUsd" + 40.0000'
    );

    const txnSave = trx.__calls.save.find((c) => c.entity === 'PharmacyWalletTransaction');
    expect(txnSave.data).toMatchObject({
      type: 'credit',
      status: 'completed',
      category: 'adjustment',
      amountUsd: '40.0000',
      payoutRequestId: 'payout-1',
    });
  });
});

// ============================================================================
// Bank accounts
// ============================================================================

describe('addBankAccount', () => {
  test('rejects with 400 when required fields are missing', async () => {
    await expect(pharmacyWalletService.addBankAccount(PHARMACY_ID, { bankName: 'GTBank' }))
      .rejects.toMatchObject({ status: 400 });
  });

  test('rejects with 404 when the wallet does not exist', async () => {
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(null);
    await expect(
      pharmacyWalletService.addBankAccount(PHARMACY_ID, {
        bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Test Pharmacy', bankCode: '058',
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  test('marks the first bank account added as the default', async () => {
    bankAccountRepo.countByPharmacy = jest.fn().mockResolvedValue(0);
    const result = await pharmacyWalletService.addBankAccount(PHARMACY_ID, {
      bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Test Pharmacy', bankCode: '058',
    });
    expect(result.isDefault).toBe(true);
    expect(bankAccountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isDefault: true }));
  });

  test('a subsequent bank account is not marked default', async () => {
    bankAccountRepo.countByPharmacy = jest.fn().mockResolvedValue(1);
    const result = await pharmacyWalletService.addBankAccount(PHARMACY_ID, {
      bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Test Pharmacy', bankCode: '058',
    });
    expect(result.isDefault).toBe(false);
  });

  test('saves the account even when Paystack verification throws', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_123';
    axios.get = jest.fn().mockRejectedValue(new Error('Paystack unreachable'));

    const result = await pharmacyWalletService.addBankAccount(PHARMACY_ID, {
      bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Test Pharmacy', bankCode: '058',
    });
    expect(result.accountName).toBe('Test Pharmacy'); // falls back to caller-supplied name
  });

  test('uses the Paystack-resolved name and recipient code when verification succeeds', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_123';
    axios.get = jest.fn().mockResolvedValue({ data: { status: true, data: { account_name: 'RESOLVED NAME' } } });
    axios.post = jest.fn().mockResolvedValue({ data: { status: true, data: { recipient_code: 'RCP_99' } } });

    const result = await pharmacyWalletService.addBankAccount(PHARMACY_ID, {
      bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Test Pharmacy', bankCode: '058',
    });

    expect(result.accountName).toBe('RESOLVED NAME');
    expect(bankAccountRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ recipientCode: 'RCP_99', accountName: 'RESOLVED NAME' })
    );
  });
});

describe('setDefaultBankAccount', () => {
  test('throws 404 when the account does not belong to this pharmacy', async () => {
    bankAccountRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(null);
    await expect(pharmacyWalletService.setDefaultBankAccount(PHARMACY_ID, 'acc-1'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('sets the given account as default', async () => {
    bankAccountRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue({ id: 'acc-1' });
    bankAccountRepo.setDefault = jest.fn().mockResolvedValue({ id: 'acc-1', isDefault: true, bankName: 'GTBank' });

    const result = await pharmacyWalletService.setDefaultBankAccount(PHARMACY_ID, 'acc-1');
    expect(result.isDefault).toBe(true);
  });
});

describe('deleteBankAccount', () => {
  test('throws 404 when the account does not belong to this pharmacy', async () => {
    bankAccountRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(null);
    await expect(pharmacyWalletService.deleteBankAccount(PHARMACY_ID, 'acc-1'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('blocks deleting the default account while other accounts exist', async () => {
    bankAccountRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue({ id: 'acc-1', isDefault: true });
    bankAccountRepo.countByPharmacy = jest.fn().mockResolvedValue(2);

    await expect(pharmacyWalletService.deleteBankAccount(PHARMACY_ID, 'acc-1'))
      .rejects.toMatchObject({ status: 422 });
    expect(bankAccountRepo.softDelete).not.toHaveBeenCalled();
  });

  test('allows deleting the default account when it is the only one', async () => {
    bankAccountRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue({ id: 'acc-1', isDefault: true });
    bankAccountRepo.countByPharmacy = jest.fn().mockResolvedValue(1);
    pharmacyPayoutRepo.findByPharmacy = jest.fn().mockResolvedValue({ payouts: [], total: 0 });

    await pharmacyWalletService.deleteBankAccount(PHARMACY_ID, 'acc-1');
    expect(bankAccountRepo.softDelete).toHaveBeenCalledWith('acc-1');
  });

  test('blocks deletion while a pending/processing payout targets this account', async () => {
    bankAccountRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue({ id: 'acc-1', isDefault: false });
    pharmacyPayoutRepo.findByPharmacy = jest.fn().mockResolvedValue({
      payouts: [{ bankAccountId: 'acc-1', status: 'processing' }],
      total: 1,
    });

    await expect(pharmacyWalletService.deleteBankAccount(PHARMACY_ID, 'acc-1'))
      .rejects.toMatchObject({ status: 422 });
    expect(bankAccountRepo.softDelete).not.toHaveBeenCalled();
  });

  test('allows deletion when no payout targets this account', async () => {
    bankAccountRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue({ id: 'acc-1', isDefault: false });
    pharmacyPayoutRepo.findByPharmacy = jest.fn().mockResolvedValue({ payouts: [], total: 0 });

    await pharmacyWalletService.deleteBankAccount(PHARMACY_ID, 'acc-1');
    expect(bankAccountRepo.softDelete).toHaveBeenCalledWith('acc-1');
  });
});
