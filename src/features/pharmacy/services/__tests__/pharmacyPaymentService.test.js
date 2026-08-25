/* eslint-env jest */
// Unit tests for pharmacyPaymentService — patient-initiated online payments
// for pharmacy invoices, gateway verification, and the webhook-driven
// handlePaymentSuccess/handleTransferSuccess/handleTransferFailed money paths.
//
// Focus areas:
//  - handlePaymentSuccess double-credit protection: invoice.status === PAID
//    is checked first and must make the whole call a no-op (it's what a
//    webhook retry AND a manual /verify call for the same payment both hit).
//  - handleTransferSuccess/handleTransferFailed idempotency on payout.status.
//  - Platform fee math on initiatePayment: patient is charged base+7% at the
//    gateway, but pharmacy always receives the full base invoice amount.
//  - Rate-lock behavior: same-currency payments use the invoice's exchange
//    rate frozen at invoice-creation time; cross-currency payments use the
//    live rate.

jest.mock('../../../../config/database');
jest.mock('../../repositories/invoiceRepository');
jest.mock('../../repositories/pharmacyPaymentRepository');
jest.mock('../../../payments/services/currencyService');
jest.mock('../../../notifications/services/notificationService');
jest.mock('../../../../shared/services/email/helper/pharmacy');
jest.mock('../../../../config/websocket');
jest.mock('../../../admin-ops/services/platformConfigService');
jest.mock('../invoiceService', () => ({
  formatInvoice: jest.fn(async (inv, currency) => ({ id: inv.id, currency, formatted: true })),
}));
jest.mock('axios');

const AppDataSource       = require('../../../../config/database');
const invoiceRepo         = require('../../repositories/invoiceRepository');
const pharmacyPaymentRepo = require('../../repositories/pharmacyPaymentRepository');
const CurrencyService     = require('../../../payments/services/currencyService');
const NotificationService = require('../../../notifications/services/notificationService');
const pharmacyEmailHelper = require('../../../../shared/services/email/helper/pharmacy');
const websocket           = require('../../../../config/websocket');
const platformConfigService = require('../../../admin-ops/services/platformConfigService');
const axios = require('axios');

const pharmacyPaymentService = require('../pharmacyPaymentService');

const PATIENT_ID  = 'aaaa0000-0000-0000-0000-000000000001';
const INVOICE_ID  = 'bbbb0000-0000-0000-0000-000000000002';
const PHARMACY_ID = 'cccc0000-0000-0000-0000-000000000003';
const PRESCRIPTION_ID = 'dddd0000-0000-0000-0000-000000000004';
const WALLET_ID   = 'eeee0000-0000-0000-0000-000000000005';

function makeInvoice(overrides = {}) {
  return {
    id: INVOICE_ID,
    reference: '#1',
    pharmacyId: PHARMACY_ID,
    patientId: PATIENT_ID,
    prescriptionId: PRESCRIPTION_ID,
    totalAmountUsd: '10.0000',
    displayCurrency: 'NGN',
    exchangeRateToUsd: 1500,
    status: 'sent',
    patient: { email: 'patient@example.com', firstName: 'Jane', lastName: 'Doe' },
    ...overrides,
  };
}

function makeFakeTrx() {
  const calls = { update: [], save: [], findOne: [] };
  const qb = { set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue(undefined) };
  return {
    update: jest.fn(async (entity, criteria, values) => { calls.update.push({ entity, criteria, values }); }),
    save: jest.fn(async (entity, data) => { calls.save.push({ entity, data }); return { id: 'x', ...data }; }),
    findOne: jest.fn(async (entity) => ({ id: WALLET_ID, pharmacyId: PHARMACY_ID, pendingClearanceUsd: '10.0000', availableBalanceUsd: '0.0000' })),
    createQueryBuilder: jest.fn(() => qb),
    __calls: calls,
    __qb: qb,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  let lastTrx;
  AppDataSource.transaction = jest.fn(async (cb) => { lastTrx = makeFakeTrx(); await cb(lastTrx); return lastTrx; });
  AppDataSource.__getLastTrx = () => lastTrx;
  AppDataSource.getRepository = jest.fn(() => ({
    findOne: jest.fn().mockResolvedValue(null),
  }));

  invoiceRepo.findByPatient = jest.fn().mockResolvedValue({ invoices: [], total: 0 });
  invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue(makeInvoice());
  invoiceRepo.findById = jest.fn().mockResolvedValue(makeInvoice());
  invoiceRepo.update = jest.fn().mockResolvedValue(undefined);

  pharmacyPaymentRepo.findPendingByInvoice = jest.fn().mockResolvedValue(null);
  pharmacyPaymentRepo.countRecentAttempts = jest.fn().mockResolvedValue(0);
  pharmacyPaymentRepo.save = jest.fn().mockImplementation(async (data) => ({ id: 'payment-1', ...data }));
  pharmacyPaymentRepo.update = jest.fn().mockResolvedValue(undefined);
  pharmacyPaymentRepo.findByReference = jest.fn().mockResolvedValue(null);

  CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('NGN');
  CurrencyService.isCurrencySupportedByProvider = jest.fn().mockResolvedValue(true);
  CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1, NGN: 1500 });

  platformConfigService.getPlatformFeeRate = jest.fn().mockResolvedValue(0.07);

  NotificationService.prototype.createNotification = jest.fn().mockResolvedValue(undefined);
  pharmacyEmailHelper.sendPaymentConfirmedPatientEmail = jest.fn().mockResolvedValue(undefined);
  pharmacyEmailHelper.sendPayoutCompletedEmail = jest.fn().mockResolvedValue(undefined);
  pharmacyEmailHelper.sendPayoutFailedEmail = jest.fn().mockResolvedValue(undefined);

  websocket.getIO = jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) }));

  axios.post = jest.fn().mockResolvedValue({ data: { status: true, data: { authorization_url: 'https://pay.example/x' } } });
  axios.get  = jest.fn().mockResolvedValue({ data: { data: { status: 'success' } } });

  process.env.PAYSTACK_SECRET_KEY = 'sk_test_123';
  process.env.FLUTTERWAVE_SECRET_KEY = 'flw_test_123';
});

// ============================================================================
// initiatePayment
// ============================================================================

describe('initiatePayment', () => {
  test('rejects when invoiceId is missing', async () => {
    await expect(pharmacyPaymentService.initiatePayment(PATIENT_ID, {}, 'NG'))
      .rejects.toMatchObject({ status: 400 });
  });

  test('rejects an unrecognized provider', async () => {
    await expect(pharmacyPaymentService.initiatePayment(PATIENT_ID, { invoiceId: INVOICE_ID, provider: 'bogus' }, 'NG'))
      .rejects.toMatchObject({ status: 400 });
  });

  test('rejects when the invoice does not exist for this patient', async () => {
    invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue(null);
    await expect(pharmacyPaymentService.initiatePayment(PATIENT_ID, { invoiceId: INVOICE_ID }, 'NG'))
      .rejects.toMatchObject({ status: 404 });
  });

  test.each(['draft', 'paid', 'cancelled', 'overdue'])(
    'rejects paying an invoice with status "%s"',
    async (status) => {
      invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue(makeInvoice({ status }));
      await expect(pharmacyPaymentService.initiatePayment(PATIENT_ID, { invoiceId: INVOICE_ID }, 'NG'))
        .rejects.toMatchObject({ status: 422 });
    }
  );

  test.each(['sent', 'viewed', 'awaiting_payment'])(
    'allows paying an invoice with status "%s"',
    async (status) => {
      invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue(makeInvoice({ status }));
      await expect(pharmacyPaymentService.initiatePayment(PATIENT_ID, { invoiceId: INVOICE_ID }, 'NG'))
        .resolves.toBeDefined();
    }
  );

  test('uses the invoice-locked exchange rate when the patient currency matches the invoice display currency', async () => {
    invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue(
      makeInvoice({ displayCurrency: 'NGN', exchangeRateToUsd: 1600, totalAmountUsd: '10.0000' })
    );
    CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('NGN');
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ NGN: 1500 }); // live rate differs

    await pharmacyPaymentService.initiatePayment(PATIENT_ID, { invoiceId: INVOICE_ID }, 'NG');

    // Base amountLocal should use the LOCKED rate (1600), not the live rate (1500): 10 * 1600 = 16000
    expect(pharmacyPaymentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ amountLocal: 16000, exchangeRate: 1600 })
    );
  });

  test('uses the live exchange rate when paying in a currency different from the invoice display currency', async () => {
    invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue(
      makeInvoice({ displayCurrency: 'NGN', exchangeRateToUsd: 1600, totalAmountUsd: '10.0000' })
    );
    CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('USD');
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1 });

    await pharmacyPaymentService.initiatePayment(PATIENT_ID, { invoiceId: INVOICE_ID, provider: 'paystack' }, 'US');

    expect(pharmacyPaymentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ amountLocal: 10, currency: 'USD' })
    );
  });

  test('charges the gateway base + 7% platform fee, while the stored payment amount is the base invoice amount', async () => {
    invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue(
      makeInvoice({ displayCurrency: 'USD', exchangeRateToUsd: 1, totalAmountUsd: '100.0000' })
    );
    CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('USD');
    platformConfigService.getPlatformFeeRate = jest.fn().mockResolvedValue(0.07);

    await pharmacyPaymentService.initiatePayment(PATIENT_ID, { invoiceId: INVOICE_ID, provider: 'paystack' }, 'US');

    // Gross charged at the gateway: 100 + 7% = 107 -> 10700 subunits
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.paystack.co/transaction/initialize',
      expect.objectContaining({ amount: 10700 }),
      expect.any(Object)
    );
    // Stored payment record reflects the base (pre-fee) amount the pharmacy is owed
    expect(pharmacyPaymentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ amountLocal: 100, amountUsd: 100 })
    );
  });

  test('returns the existing pending payment unchanged when currency/provider/amount all still match (idempotent)', async () => {
    pharmacyPaymentRepo.findPendingByInvoice = jest.fn().mockResolvedValue({
      id: 'existing-payment', invoiceId: INVOICE_ID, amountLocal: '15000.00', currency: 'NGN',
      provider: 'paystack', status: 'pending', authorizationUrl: 'https://pay.example/old', reference: 'OLD-REF',
    });
    CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('NGN');
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ NGN: 1500 });
    invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue(
      makeInvoice({ displayCurrency: 'NGN', exchangeRateToUsd: 1500, totalAmountUsd: '10.0000' })
    );

    const result = await pharmacyPaymentService.initiatePayment(PATIENT_ID, { invoiceId: INVOICE_ID, provider: 'paystack' }, 'NG');

    expect(result.paymentId).toBe('existing-payment');
    expect(pharmacyPaymentRepo.save).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('voids a stale pending payment and creates a fresh one when the currency no longer matches', async () => {
    pharmacyPaymentRepo.findPendingByInvoice = jest.fn().mockResolvedValue({
      id: 'stale-payment', invoiceId: INVOICE_ID, amountLocal: '10.00', currency: 'USD',
      provider: 'paystack', status: 'pending',
    });
    CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('NGN');

    await pharmacyPaymentService.initiatePayment(PATIENT_ID, { invoiceId: INVOICE_ID, provider: 'paystack' }, 'NG');

    expect(pharmacyPaymentRepo.update).toHaveBeenCalledWith('stale-payment', { status: 'failed' });
    expect(pharmacyPaymentRepo.save).toHaveBeenCalled();
  });

  test('rejects with 429 after 5 payment attempts in the last hour', async () => {
    pharmacyPaymentRepo.countRecentAttempts = jest.fn().mockResolvedValue(5);
    await expect(pharmacyPaymentService.initiatePayment(PATIENT_ID, { invoiceId: INVOICE_ID }, 'NG'))
      .rejects.toMatchObject({ status: 429 });
  });

  test('wraps a gateway initialization failure in a 502 error', async () => {
    axios.post = jest.fn().mockRejectedValue({ response: { data: { message: 'Invalid currency' } } });
    await expect(pharmacyPaymentService.initiatePayment(PATIENT_ID, { invoiceId: INVOICE_ID, provider: 'paystack' }, 'NG'))
      .rejects.toMatchObject({ status: 502 });
    expect(pharmacyPaymentRepo.save).not.toHaveBeenCalled();
  });

  test('falls back to flutterwave when requested provider is flutterwave', async () => {
    axios.post = jest.fn().mockResolvedValue({ data: { status: 'success', data: { link: 'https://flw.example/x' } } });
    await pharmacyPaymentService.initiatePayment(PATIENT_ID, { invoiceId: INVOICE_ID, provider: 'flutterwave' }, 'NG');
    expect(axios.post).toHaveBeenCalledWith('https://api.flutterwave.com/v3/payments', expect.any(Object), expect.any(Object));
  });
});

// ============================================================================
// verifyPayment
// ============================================================================

describe('verifyPayment', () => {
  test('throws 404 when the payment reference is unknown', async () => {
    pharmacyPaymentRepo.findByReference = jest.fn().mockResolvedValue(null);
    await expect(pharmacyPaymentService.verifyPayment(PATIENT_ID, 'ref-1')).rejects.toMatchObject({ status: 404 });
  });

  test('short-circuits without re-verifying when the payment already succeeded', async () => {
    pharmacyPaymentRepo.findByReference = jest.fn().mockResolvedValue({
      id: 'p1', invoiceId: INVOICE_ID, amountLocal: '100.00', currency: 'USD', status: 'success', reference: 'ref-1',
    });
    const result = await pharmacyPaymentService.verifyPayment(PATIENT_ID, 'ref-1');
    expect(result.status).toBe('success');
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('confirms the payment and processes it exactly once when the gateway reports success', async () => {
    pharmacyPaymentRepo.findByReference = jest.fn()
      .mockResolvedValueOnce({ id: 'p1', invoiceId: INVOICE_ID, provider: 'paystack', status: 'pending', reference: 'ref-1' })
      .mockResolvedValueOnce({ id: 'p1', invoiceId: INVOICE_ID, provider: 'paystack', status: 'success', amountLocal: '100.00', currency: 'USD', reference: 'ref-1' });
    axios.get = jest.fn().mockResolvedValue({ data: { data: { status: 'success' } } });

    const result = await pharmacyPaymentService.verifyPayment(PATIENT_ID, 'ref-1');

    expect(result.status).toBe('success');
    const trx = AppDataSource.__getLastTrx();
    expect(trx.__calls.update.some((c) => c.entity === 'Invoice' && c.values.status === 'paid')).toBe(true);
  });

  test('leaves the payment pending when the gateway has not confirmed success', async () => {
    pharmacyPaymentRepo.findByReference = jest.fn().mockResolvedValue({
      id: 'p1', invoiceId: INVOICE_ID, provider: 'paystack', status: 'pending', amountLocal: '100.00', currency: 'USD', reference: 'ref-1',
    });
    axios.get = jest.fn().mockResolvedValue({ data: { data: { status: 'abandoned' } } });

    const result = await pharmacyPaymentService.verifyPayment(PATIENT_ID, 'ref-1');
    expect(result.status).toBe('pending');
    expect(AppDataSource.transaction).not.toHaveBeenCalled();
  });

  test('wraps a gateway verification error in a 502', async () => {
    pharmacyPaymentRepo.findByReference = jest.fn().mockResolvedValue({
      id: 'p1', invoiceId: INVOICE_ID, provider: 'paystack', status: 'pending', reference: 'ref-1',
    });
    axios.get = jest.fn().mockRejectedValue(new Error('network error'));
    await expect(pharmacyPaymentService.verifyPayment(PATIENT_ID, 'ref-1')).rejects.toMatchObject({ status: 502 });
  });
});

// ============================================================================
// handlePaymentSuccess — the core webhook-driven money-moving transaction
// ============================================================================

describe('handlePaymentSuccess', () => {
  test('is a no-op (idempotent) when the invoice is already paid', async () => {
    invoiceRepo.findById = jest.fn().mockResolvedValue(makeInvoice({ status: 'paid' }));
    await pharmacyPaymentService.handlePaymentSuccess(INVOICE_ID, { id: 'payment-1', reference: 'ref-1' });
    expect(AppDataSource.transaction).not.toHaveBeenCalled();
  });

  test('throws when the invoice cannot be found', async () => {
    invoiceRepo.findById = jest.fn().mockResolvedValue(null);
    await expect(pharmacyPaymentService.handlePaymentSuccess(INVOICE_ID, {})).rejects.toThrow(`Invoice ${INVOICE_ID} not found`);
  });

  test('credits the pharmacy with 100% of the invoice total (no platform fee) into pendingClearance, and marks invoice/prescription/payment paid', async () => {
    invoiceRepo.findById = jest.fn().mockResolvedValue(makeInvoice({ totalAmountUsd: '50.0000', status: 'sent' }));

    await pharmacyPaymentService.handlePaymentSuccess(INVOICE_ID, { id: 'payment-1', reference: 'ref-1' });

    const trx = AppDataSource.__getLastTrx();
    expect(trx.__calls.update).toContainEqual(
      expect.objectContaining({ entity: 'Invoice', criteria: { id: INVOICE_ID }, values: expect.objectContaining({ status: 'paid' }) })
    );
    expect(trx.__calls.update).toContainEqual(
      expect.objectContaining({ entity: 'Prescription', values: { status: 'in_progress', paymentStatus: 'paid' } })
    );

    const walletUpdate = trx.__calls.update.find((c) => c.entity === 'PharmacyWallet');
    expect(walletUpdate.values.pendingClearanceUsd()).toBe('"pendingClearanceUsd" + 50');
    expect(walletUpdate.values.totalEarningsUsd()).toBe('"totalEarningsUsd" + 50');

    const txnSave = trx.__calls.save.find((c) => c.entity === 'PharmacyWalletTransaction');
    expect(txnSave.data).toMatchObject({ type: 'credit', status: 'pending', category: 'invoice_payment', amountUsd: 50 });

    expect(trx.__calls.update).toContainEqual(
      expect.objectContaining({ entity: 'PharmacyPayment', criteria: { id: 'payment-1' }, values: { status: 'success' } })
    );
  });

  test('still marks invoice/payment paid even if the pharmacy has no wallet yet (no wallet transaction created)', async () => {
    invoiceRepo.findById = jest.fn().mockResolvedValue(makeInvoice({ status: 'sent' }));
    const trxNoWallet = {
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(null), // no wallet found
    };
    AppDataSource.transaction = jest.fn(async (cb) => { await cb(trxNoWallet); });

    await pharmacyPaymentService.handlePaymentSuccess(INVOICE_ID, { id: 'payment-1' });

    expect(trxNoWallet.update).toHaveBeenCalledWith('Invoice', { id: INVOICE_ID }, expect.objectContaining({ status: 'paid' }));
    expect(trxNoWallet.save).not.toHaveBeenCalled(); // no PharmacyWalletTransaction row
  });

  test('does not throw when notifications fail after the transaction has committed', async () => {
    invoiceRepo.findById = jest.fn().mockResolvedValue(makeInvoice({ status: 'sent' }));
    websocket.getIO = jest.fn(() => { throw new Error('socket down'); });
    NotificationService.prototype.createNotification = jest.fn().mockRejectedValue(new Error('notif down'));

    await expect(pharmacyPaymentService.handlePaymentSuccess(INVOICE_ID, { id: 'payment-1' })).resolves.toBeUndefined();
  });
});

// ============================================================================
// handleTransferSuccess / handleTransferFailed — payout webhook idempotency
// ============================================================================

describe('handleTransferSuccess', () => {
  test('is a no-op when the payout cannot be found', async () => {
    AppDataSource.getRepository = jest.fn(() => ({ findOne: jest.fn().mockResolvedValue(null) }));
    await pharmacyPaymentService.handleTransferSuccess('TRF_1');
    expect(AppDataSource.transaction).not.toHaveBeenCalled();
  });

  test('is a no-op when the payout is already completed (duplicate webhook)', async () => {
    AppDataSource.getRepository = jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue({ id: 'payout-1', status: 'completed' }),
    }));
    await pharmacyPaymentService.handleTransferSuccess('TRF_1');
    expect(AppDataSource.transaction).not.toHaveBeenCalled();
  });

  test('marks the payout completed and settles the matching wallet transaction', async () => {
    AppDataSource.getRepository = jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue({ id: 'payout-1', status: 'processing', pharmacyId: PHARMACY_ID, reference: 'PAYOUT-1' }),
    }));

    await pharmacyPaymentService.handleTransferSuccess('TRF_1');

    const trx = AppDataSource.__getLastTrx();
    expect(trx.__calls.update).toContainEqual(
      expect.objectContaining({ entity: 'PharmacyPayoutRequest', criteria: { id: 'payout-1' }, values: expect.objectContaining({ status: 'completed' }) })
    );
    expect(trx.__qb.where).toHaveBeenCalledWith(
      'reference = :ref AND category = :cat',
      { ref: 'PAYOUT-1', cat: 'payout' }
    );
  });
});

describe('handleTransferFailed', () => {
  test.each(['completed', 'failed', 'cancelled'])('is a no-op when the payout is already terminal ("%s")', async (status) => {
    AppDataSource.getRepository = jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue({ id: 'payout-1', status }),
    }));
    await pharmacyPaymentService.handleTransferFailed('TRF_1');
    expect(AppDataSource.transaction).not.toHaveBeenCalled();
  });

  test('restores the exact payout amount to available balance and marks the payout failed', async () => {
    AppDataSource.getRepository = jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue({
        id: 'payout-1', status: 'processing', pharmacyId: PHARMACY_ID, reference: 'PAYOUT-1', amountUsd: '25.0000',
      }),
    }));

    await pharmacyPaymentService.handleTransferFailed('TRF_1', 'Insufficient funds in Paystack balance');

    const trx = AppDataSource.__getLastTrx();
    expect(trx.__calls.update).toContainEqual(
      expect.objectContaining({
        entity: 'PharmacyPayoutRequest',
        criteria: { id: 'payout-1' },
        values: expect.objectContaining({ status: 'failed', failureReason: 'Insufficient funds in Paystack balance' }),
      })
    );
    const walletUpdate = trx.__calls.update.find((c) => c.entity === 'PharmacyWallet');
    expect(walletUpdate.values.availableBalanceUsd()).toBe('"availableBalanceUsd" + 25.0000');

    const txnSave = trx.__calls.save.find((c) => c.entity === 'PharmacyWalletTransaction');
    expect(txnSave.data).toMatchObject({ type: 'credit', status: 'completed', category: 'adjustment', amountUsd: '25.0000' });
  });
});
