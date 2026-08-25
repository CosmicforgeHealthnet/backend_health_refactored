/* eslint-env jest */
// Unit tests for patientWalletService — patient-side wallet top-ups.
//
// The highest-risk path here is handleTopUpSuccess/handleTopUpFailed, called
// from payment-gateway webhooks (pharmacyWebhookController). Gateways
// routinely redeliver the same webhook event, so this must be safe against
// being invoked twice for the same reference (double-credit risk) — this is
// exactly the "two fields tracking the same state can drift" / double-credit
// class of bug this testing effort was started to find.
//
// BUG FOUND & FIXED (2026-08-25): handleTopUpSuccess used to
// find-then-credit-then-mark-completed as three separate steps. Two
// concurrent/duplicate webhook deliveries for the same reference could both
// pass the `txn.status !== PENDING` guard (read before either write lands)
// and each credit the wallet — a double-credit. Fixed by adding
// patientWalletTransactionRepository.markCompletedIfPending/markFailedIfPending,
// which do a conditional `UPDATE ... WHERE status = 'pending'` and return an
// affected-row count; the service now only credits the wallet if its own
// call actually won that race (result.affected > 0).

jest.mock('../../repositories/patientWalletRepository');
jest.mock('../../repositories/patientWalletTransactionRepository');
jest.mock('../../../payments/services/currencyService');
jest.mock('axios');

const patientWalletRepo    = require('../../repositories/patientWalletRepository');
const patientWalletTxnRepo = require('../../repositories/patientWalletTransactionRepository');
const CurrencyService      = require('../../../payments/services/currencyService');
const axios = require('axios');

const patientWalletService = require('../patientWalletService');

const PATIENT_ID = 'aaaa0000-0000-0000-0000-000000000001';
const WALLET_ID  = 'bbbb0000-0000-0000-0000-000000000002';

function makeWallet(overrides = {}) {
  return {
    id: WALLET_ID,
    patientId: PATIENT_ID,
    balanceUsd: '0.0000',
    totalSpentUsd: '0.0000',
    totalTopUpsUsd: '0.0000',
    preferredDisplayCurrency: 'USD',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  patientWalletRepo.findByPatientId = jest.fn().mockResolvedValue(makeWallet());
  patientWalletRepo.save = jest.fn().mockImplementation(async (data) => makeWallet(data));
  patientWalletRepo.creditBalance = jest.fn().mockResolvedValue(undefined);
  patientWalletRepo.debitBalance = jest.fn().mockResolvedValue(undefined);

  patientWalletTxnRepo.findByWallet = jest.fn().mockResolvedValue({ transactions: [], total: 0 });
  patientWalletTxnRepo.findByReference = jest.fn().mockResolvedValue(null);
  patientWalletTxnRepo.save = jest.fn().mockResolvedValue(undefined);
  patientWalletTxnRepo.markCompletedIfPending = jest.fn().mockResolvedValue({ affected: 1 });
  patientWalletTxnRepo.markFailedIfPending = jest.fn().mockResolvedValue({ affected: 1 });
  patientWalletTxnRepo.update = jest.fn().mockResolvedValue(undefined);

  CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('USD');
  CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1, NGN: 1500 });
  CurrencyService.isCurrencySupportedByProvider = jest.fn().mockResolvedValue(true);

  axios.post = jest.fn().mockResolvedValue({ data: { data: { authorization_url: 'https://pay.example/x', link: 'https://pay.example/y' } } });
});

// ============================================================================
// getSummary / getTransactions — currency conversion
// ============================================================================

describe('getSummary', () => {
  test('converts USD balances into the resolved display currency', async () => {
    patientWalletRepo.findByPatientId = jest.fn().mockResolvedValue(
      makeWallet({ balanceUsd: '10.0000', totalSpentUsd: '5.0000', totalTopUpsUsd: '15.0000' })
    );
    CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('NGN');
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ NGN: 1500 });

    const result = await patientWalletService.getSummary(PATIENT_ID, 'NG');

    expect(result).toEqual({ balance: 15000, totalSpent: 7500, totalTopUps: 22500, currency: 'NGN' });
  });

  test('creates a wallet on first access instead of throwing', async () => {
    patientWalletRepo.findByPatientId = jest.fn().mockResolvedValue(null);
    const result = await patientWalletService.getSummary(PATIENT_ID, 'US');
    expect(patientWalletRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: PATIENT_ID })
    );
    expect(result.balance).toBe(0);
  });
});

describe('getTransactions', () => {
  test('caps limit at 100 and converts each transaction amount', async () => {
    patientWalletTxnRepo.findByWallet = jest.fn().mockResolvedValue({
      transactions: [{ id: 't1', type: 'credit', status: 'completed', category: 'top_up', amountUsd: '2.0000' }],
      total: 1,
    });
    CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('NGN');
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ NGN: 1500 });

    const result = await patientWalletService.getTransactions(PATIENT_ID, { limit: 999 }, 'NG');

    expect(patientWalletTxnRepo.findByWallet).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100, page: 1 })
    );
    expect(result.items[0].amount).toBe(3000);
    expect(result.currency).toBe('NGN');
  });
});

// ============================================================================
// initiateTopUp
// ============================================================================

describe('initiateTopUp', () => {
  test('rejects a missing or non-positive amount', async () => {
    await expect(patientWalletService.initiateTopUp(PATIENT_ID, {}, 'US'))
      .rejects.toMatchObject({ status: 400 });
    await expect(patientWalletService.initiateTopUp(PATIENT_ID, { amount: 0 }, 'US'))
      .rejects.toMatchObject({ status: 400 });
    await expect(patientWalletService.initiateTopUp(PATIENT_ID, { amount: -5 }, 'US'))
      .rejects.toMatchObject({ status: 400 });
  });

  test('converts the requested display-currency amount to USD before recording the pending transaction', async () => {
    CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('NGN');
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ NGN: 1500 });
    CurrencyService.isCurrencySupportedByProvider = jest.fn().mockResolvedValue(true); // paystack ok

    await patientWalletService.initiateTopUp(PATIENT_ID, { amount: 150000 }, 'NG');

    expect(patientWalletTxnRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        amountUsd: 100, // 150000 / 1500
        status: 'pending',
        type: 'credit',
        category: 'top_up',
      })
    );
  });

  test('computes balanceAfterUsd against the current balance at initiation time', async () => {
    patientWalletRepo.findByPatientId = jest.fn().mockResolvedValue(makeWallet({ balanceUsd: '20.0000' }));
    await patientWalletService.initiateTopUp(PATIENT_ID, { amount: 30 }, 'US');

    expect(patientWalletTxnRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ balanceAfterUsd: 50 }) // 20 + 30
    );
  });

  test('uses Paystack when paystack supports the resolved currency', async () => {
    CurrencyService.isCurrencySupportedByProvider = jest.fn()
      .mockImplementation(async (currency, provider) => provider === 'paystack');

    await patientWalletService.initiateTopUp(PATIENT_ID, { amount: 30 }, 'US');

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.paystack.co/transaction/initialize',
      expect.any(Object),
      expect.any(Object)
    );
  });

  test('falls back to Flutterwave when paystack does not support the currency', async () => {
    CurrencyService.isCurrencySupportedByProvider = jest.fn()
      .mockImplementation(async (currency, provider) => provider === 'flutterwave');

    await patientWalletService.initiateTopUp(PATIENT_ID, { amount: 30 }, 'US');

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.flutterwave.com/v3/payments',
      expect.any(Object),
      expect.any(Object)
    );
  });

  test('wraps a gateway failure in a 502 error and does not record a pending transaction', async () => {
    axios.post = jest.fn().mockRejectedValue(new Error('gateway timeout'));

    await expect(patientWalletService.initiateTopUp(PATIENT_ID, { amount: 30 }, 'US'))
      .rejects.toMatchObject({ status: 502 });
    expect(patientWalletTxnRepo.save).not.toHaveBeenCalled();
  });
});

// ============================================================================
// handleTopUpSuccess — double-credit protection (webhook idempotency)
// ============================================================================

describe('handleTopUpSuccess', () => {
  test('credits the wallet exactly once for a pending transaction', async () => {
    patientWalletTxnRepo.findByReference = jest.fn().mockResolvedValue({
      id: 'txn-1', patientId: PATIENT_ID, status: 'pending', amountUsd: '10.0000',
    });

    await patientWalletService.handleTopUpSuccess('PWU-123');

    expect(patientWalletTxnRepo.markCompletedIfPending).toHaveBeenCalledWith('txn-1');
    expect(patientWalletRepo.creditBalance).toHaveBeenCalledWith(PATIENT_ID, 10);
  });

  test('does nothing when the reference is unknown', async () => {
    patientWalletTxnRepo.findByReference = jest.fn().mockResolvedValue(null);
    await patientWalletService.handleTopUpSuccess('unknown-ref');
    expect(patientWalletRepo.creditBalance).not.toHaveBeenCalled();
  });

  test('does nothing when the transaction is not (or no longer) pending', async () => {
    patientWalletTxnRepo.findByReference = jest.fn().mockResolvedValue({
      id: 'txn-1', patientId: PATIENT_ID, status: 'completed', amountUsd: '10.0000',
    });
    await patientWalletService.handleTopUpSuccess('PWU-123');
    expect(patientWalletTxnRepo.markCompletedIfPending).not.toHaveBeenCalled();
    expect(patientWalletRepo.creditBalance).not.toHaveBeenCalled();
  });

  test('a duplicate/concurrent webhook delivery for the same reference credits the wallet only once', async () => {
    // Simulate the race: both calls read the txn as PENDING (findByReference
    // does not itself flip status), but only the first conditional UPDATE
    // can affect a row.
    patientWalletTxnRepo.findByReference = jest.fn().mockResolvedValue({
      id: 'txn-1', patientId: PATIENT_ID, status: 'pending', amountUsd: '10.0000',
    });
    patientWalletTxnRepo.markCompletedIfPending = jest.fn()
      .mockResolvedValueOnce({ affected: 1 })  // first delivery wins the race
      .mockResolvedValueOnce({ affected: 0 }); // second delivery finds it already completed

    await patientWalletService.handleTopUpSuccess('PWU-123');
    await patientWalletService.handleTopUpSuccess('PWU-123');

    expect(patientWalletRepo.creditBalance).toHaveBeenCalledTimes(1);
  });
});

describe('handleTopUpFailed', () => {
  test('marks a pending transaction as failed', async () => {
    patientWalletTxnRepo.findByReference = jest.fn().mockResolvedValue({ id: 'txn-1', status: 'pending' });
    await patientWalletService.handleTopUpFailed('PWU-123');
    expect(patientWalletTxnRepo.markFailedIfPending).toHaveBeenCalledWith('txn-1');
  });

  test('does nothing for an unknown reference or a non-pending transaction', async () => {
    patientWalletTxnRepo.findByReference = jest.fn().mockResolvedValue(null);
    await patientWalletService.handleTopUpFailed('unknown');
    expect(patientWalletTxnRepo.markFailedIfPending).not.toHaveBeenCalled();

    patientWalletTxnRepo.findByReference = jest.fn().mockResolvedValue({ id: 'txn-1', status: 'completed' });
    await patientWalletService.handleTopUpFailed('PWU-123');
    expect(patientWalletTxnRepo.markFailedIfPending).not.toHaveBeenCalled();
  });
});
