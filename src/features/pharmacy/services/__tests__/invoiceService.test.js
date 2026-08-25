/* eslint-env jest */
// Unit tests for invoiceService — pharmacy-created invoices, currency
// conversion between the pharmacy's local display currency and the USD
// values actually stored, and the pay_on_pickup markPaid path that credits
// the pharmacy wallet with no escrow hold.
//
// Focus areas: rounding precision on the local<->USD conversions (4 dp for
// stored USD, 2 dp for display amounts), status-transition guards (draft-only
// update/send, no double-paying/double-cancelling an invoice), and that
// markPaid's wallet credit amount always matches invoice.totalAmountUsd.

jest.mock('../../../../config/database');
jest.mock('../../repositories/invoiceRepository');
jest.mock('../../repositories/pharmacyWalletRepository');
jest.mock('../../repositories/prescriptionRepository');
jest.mock('../../repositories/pharmacyProfileRepository');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('../../../payments/services/currencyService');
jest.mock('../../../notifications/services/notificationService');
jest.mock('../../../../shared/services/email/helper/pharmacy');
jest.mock('../../../../config/websocket');

const AppDataSource       = require('../../../../config/database');
const invoiceRepo         = require('../../repositories/invoiceRepository');
const pharmacyWalletRepo  = require('../../repositories/pharmacyWalletRepository');
const prescriptionRepo    = require('../../repositories/prescriptionRepository');
const pharmacyProfileRepo = require('../../repositories/pharmacyProfileRepository');
const userRepo            = require('../../../auth/repositories/userRepository');
const CurrencyService     = require('../../../payments/services/currencyService');
const NotificationService = require('../../../notifications/services/notificationService');
const pharmacyEmailHelper = require('../../../../shared/services/email/helper/pharmacy');
const websocket           = require('../../../../config/websocket');

const invoiceService = require('../invoiceService');

const PHARMACY_ID = 'aaaa0000-0000-0000-0000-000000000001';
const INVOICE_ID  = 'bbbb0000-0000-0000-0000-000000000002';
const PRESCRIPTION_ID = 'cccc0000-0000-0000-0000-000000000003';
const PATIENT_ID  = 'dddd0000-0000-0000-0000-000000000004';
const WALLET_ID   = 'eeee0000-0000-0000-0000-000000000005';

function makeInvoice(overrides = {}) {
  return {
    id: INVOICE_ID,
    reference: '#1',
    prescriptionId: PRESCRIPTION_ID,
    pharmacyId: PHARMACY_ID,
    patientId: PATIENT_ID,
    subtotalUsd: '10.0000',
    deliveryFeeUsd: '1.0000',
    totalAmountUsd: '11.0000',
    displayCurrency: 'NGN',
    exchangeRateToUsd: 1500,
    paymentMethod: 'online',
    status: 'draft',
    lineItems: [],
    ...overrides,
  };
}

function makeFakeTrx() {
  const calls = { update: [], save: [], findOne: [] };
  return {
    update: jest.fn(async (entity, criteria, values) => { calls.update.push({ entity, criteria, values }); }),
    save: jest.fn(async (entity, data) => { calls.save.push({ entity, data }); return { id: 'x', ...data }; }),
    findOne: jest.fn(async (entity) => ({ id: WALLET_ID, availableBalanceUsd: '11.0000' })),
    __calls: calls,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  let lastTrx;
  AppDataSource.transaction = jest.fn(async (cb) => { lastTrx = makeFakeTrx(); await cb(lastTrx); return lastTrx; });
  AppDataSource.__getLastTrx = () => lastTrx;
  AppDataSource.getRepository = jest.fn(() => ({
    delete: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
  }));

  invoiceRepo.findByPharmacy = jest.fn().mockResolvedValue({ invoices: [], total: 0 });
  invoiceRepo.findById = jest.fn().mockResolvedValue(makeInvoice());
  invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeInvoice());
  invoiceRepo.getNextSequence = jest.fn().mockResolvedValue(1);
  invoiceRepo.save = jest.fn().mockImplementation(async (data) => ({ id: INVOICE_ID, ...data }));
  invoiceRepo.update = jest.fn().mockResolvedValue(undefined);

  pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue({ id: WALLET_ID, pharmacyId: PHARMACY_ID });
  pharmacyWalletRepo.save = jest.fn().mockResolvedValue({ id: WALLET_ID });

  prescriptionRepo.findById = jest.fn().mockResolvedValue({
    id: PRESCRIPTION_ID, pharmacyId: PHARMACY_ID, patientId: PATIENT_ID, status: 'under_review',
  });
  prescriptionRepo.updateStatus = jest.fn().mockResolvedValue(undefined);
  prescriptionRepo.updateFields = jest.fn().mockResolvedValue(undefined);

  pharmacyProfileRepo.findById = jest.fn().mockResolvedValue({
    id: PHARMACY_ID, pharmacyName: 'Test Pharmacy', defaultCurrency: 'NGN',
  });

  userRepo.findById = jest.fn().mockResolvedValue({ id: PATIENT_ID, email: 'patient@example.com', firstName: 'Jane', lastName: 'Doe' });

  CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1, NGN: 1500 });

  NotificationService.prototype.createNotification = jest.fn().mockResolvedValue(undefined);
  pharmacyEmailHelper.sendInvoiceSentEmail = jest.fn().mockResolvedValue(undefined);
  pharmacyEmailHelper.sendPaymentConfirmedPatientEmail = jest.fn().mockResolvedValue(undefined);

  websocket.getIO = jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) }));
});

// ============================================================================
// createInvoice
// ============================================================================

describe('createInvoice', () => {
  const BODY = {
    prescriptionId: PRESCRIPTION_ID,
    lineItems: [{ medicationName: 'Panadol', quantity: 2, unitPrice: 1500 }],
    deliveryFee: 750,
    paymentMethod: 'online',
  };

  test('rejects when no line items are supplied', async () => {
    await expect(invoiceService.createInvoice(PHARMACY_ID, { ...BODY, lineItems: [] }))
      .rejects.toMatchObject({ status: 400 });
  });

  test('rejects when the prescription does not exist', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(null);
    await expect(invoiceService.createInvoice(PHARMACY_ID, BODY))
      .rejects.toMatchObject({ status: 404 });
  });

  test('rejects when the prescription belongs to a different pharmacy', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue({ id: PRESCRIPTION_ID, pharmacyId: 'someone-else' });
    await expect(invoiceService.createInvoice(PHARMACY_ID, BODY))
      .rejects.toMatchObject({ status: 403 });
  });

  test('rejects with 409 when an active invoice already exists for this prescription', async () => {
    invoiceRepo.findByPharmacy = jest.fn().mockResolvedValue({
      invoices: [makeInvoice({ status: 'sent', reference: '#5' })], total: 1,
    });
    await expect(invoiceService.createInvoice(PHARMACY_ID, BODY))
      .rejects.toMatchObject({ status: 409 });
  });

  test('allows a new invoice when the only prior one was cancelled', async () => {
    invoiceRepo.findByPharmacy = jest.fn().mockResolvedValue({
      invoices: [makeInvoice({ status: 'cancelled' })], total: 1,
    });
    await expect(invoiceService.createInvoice(PHARMACY_ID, BODY)).resolves.toBeDefined();
  });

  test('rejects a line item missing required fields', async () => {
    await expect(
      invoiceService.createInvoice(PHARMACY_ID, { ...BODY, lineItems: [{ medicationName: 'X' }] })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('rejects a line item with quantity below 1', async () => {
    // Note: quantity: 0 is falsy, so it's actually caught by the earlier
    // "missing required field" guard rather than the `quantity < 1` check
    // below it (which is effectively dead for 0, only reachable for negative
    // quantities) — either way the request is correctly rejected with 400.
    await expect(
      invoiceService.createInvoice(PHARMACY_ID, {
        ...BODY, lineItems: [{ medicationName: 'X', quantity: 0, unitPrice: 100 }],
      })
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      invoiceService.createInvoice(PHARMACY_ID, {
        ...BODY, lineItems: [{ medicationName: 'X', quantity: -1, unitPrice: 100 }],
      })
    ).rejects.toMatchObject({ status: 400, message: 'Quantity must be at least 1' });
  });

  test('converts local-currency line items and delivery fee to USD at 4dp and sums the total correctly', async () => {
    // rate NGN = 1500. unitPrice 1500 NGN -> 1 USD; quantity 2 -> subtotal 2 USD.
    // deliveryFee 750 NGN -> 0.5 USD. total = 2.5 USD.
    await invoiceService.createInvoice(PHARMACY_ID, BODY);

    expect(invoiceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotalUsd: 2,
        deliveryFeeUsd: 0.5,
        totalAmountUsd: 2.5,
        displayCurrency: 'NGN',
        exchangeRateToUsd: 1500,
        status: 'draft',
        lineItems: [
          expect.objectContaining({ medicationName: 'Panadol', quantity: 2, unitPriceUsd: 1, subtotalUsd: 2 }),
        ],
      })
    );
  });

  test('uses a pharmacy-scoped sequential reference (#N)', async () => {
    invoiceRepo.getNextSequence = jest.fn().mockResolvedValue(42);
    await invoiceService.createInvoice(PHARMACY_ID, BODY);
    expect(invoiceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ reference: '#42' }));
  });
});

// ============================================================================
// updateInvoice
// ============================================================================

describe('updateInvoice', () => {
  test('throws 404 when the invoice does not exist for this pharmacy', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(null);
    await expect(invoiceService.updateInvoice(PHARMACY_ID, INVOICE_ID, {}))
      .rejects.toMatchObject({ status: 404 });
  });

  test('rejects updating a non-draft invoice', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeInvoice({ status: 'sent' }));
    await expect(invoiceService.updateInvoice(PHARMACY_ID, INVOICE_ID, { notes: 'x' }))
      .rejects.toMatchObject({ status: 422 });
  });

  test('recomputes totalAmountUsd when only deliveryFee changes', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(
      makeInvoice({ subtotalUsd: '10.0000', deliveryFeeUsd: '1.0000' })
    );
    // NGN rate 1500: new deliveryFee 3000 NGN -> 2 USD; total = 10 + 2 = 12
    await invoiceService.updateInvoice(PHARMACY_ID, INVOICE_ID, { deliveryFee: 3000 });

    expect(invoiceRepo.update).toHaveBeenCalledWith(INVOICE_ID, expect.objectContaining({
      deliveryFeeUsd: 2, totalAmountUsd: 12,
    }));
  });

  test('replacing line items recomputes subtotal, keeps existing deliveryFee if not also updated, and rewrites line items', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(
      makeInvoice({ subtotalUsd: '10.0000', deliveryFeeUsd: '1.0000' })
    );
    const deleteMock = jest.fn().mockResolvedValue(undefined);
    const saveMock   = jest.fn().mockResolvedValue(undefined);
    AppDataSource.getRepository = jest.fn(() => ({ delete: deleteMock, save: saveMock }));

    await invoiceService.updateInvoice(PHARMACY_ID, INVOICE_ID, {
      lineItems: [{ medicationName: 'Amoxicillin', quantity: 3, unitPrice: 1500 }], // 3 USD
    });

    expect(deleteMock).toHaveBeenCalledWith({ invoiceId: INVOICE_ID });
    expect(saveMock).toHaveBeenCalledWith([
      expect.objectContaining({ medicationName: 'Amoxicillin', unitPriceUsd: 1, subtotalUsd: 3, invoiceId: INVOICE_ID }),
    ]);
    expect(invoiceRepo.update).toHaveBeenCalledWith(INVOICE_ID, expect.objectContaining({
      subtotalUsd: 3,
      deliveryFeeUsd: 1, // kept from existing invoice, not touched
      totalAmountUsd: 4,
    }));
  });
});

// ============================================================================
// sendInvoice
// ============================================================================

describe('sendInvoice', () => {
  test('throws 404 when invoice not found', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(null);
    await expect(invoiceService.sendInvoice(PHARMACY_ID, INVOICE_ID)).rejects.toMatchObject({ status: 404 });
  });

  test('rejects sending a non-draft invoice', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeInvoice({ status: 'sent' }));
    await expect(invoiceService.sendInvoice(PHARMACY_ID, INVOICE_ID)).rejects.toMatchObject({ status: 422 });
  });

  test('moves invoice to SENT and prescription to AWAITING_PAYMENT', async () => {
    await invoiceService.sendInvoice(PHARMACY_ID, INVOICE_ID);

    expect(invoiceRepo.update).toHaveBeenCalledWith(INVOICE_ID, expect.objectContaining({ status: 'sent' }));
    expect(prescriptionRepo.updateStatus).toHaveBeenCalledWith(PRESCRIPTION_ID, 'awaiting_payment');
  });

  test('defaults dueAt to 7 days out when the invoice has none set', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeInvoice({ dueAt: null }));
    const before = Date.now();

    await invoiceService.sendInvoice(PHARMACY_ID, INVOICE_ID);

    const updateCall = invoiceRepo.update.mock.calls.find(c => c[1].status === 'sent');
    const dueAt = updateCall[1].dueAt.getTime();
    expect(dueAt).toBeGreaterThan(before + 6 * 24 * 60 * 60 * 1000);
    expect(dueAt).toBeLessThan(before + 8 * 24 * 60 * 60 * 1000);
  });

  test('keeps the existing dueAt when already set', async () => {
    const existingDueAt = new Date('2026-09-01T00:00:00Z');
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeInvoice({ dueAt: existingDueAt }));

    await invoiceService.sendInvoice(PHARMACY_ID, INVOICE_ID);

    const updateCall = invoiceRepo.update.mock.calls.find(c => c[1].status === 'sent');
    expect(updateCall[1].dueAt).toBe(existingDueAt);
  });

  test('syncs deliveryFee/totalDue onto the prescription using the invoice-locked exchange rate', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(
      makeInvoice({ deliveryFeeUsd: '1.0000', totalAmountUsd: '11.0000', exchangeRateToUsd: 1500 })
    );

    await invoiceService.sendInvoice(PHARMACY_ID, INVOICE_ID);

    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(PRESCRIPTION_ID, {
      deliveryFee: 1500,   // 1 USD * 1500
      totalDue: 16500,     // 11 USD * 1500
    });
  });

  test('still succeeds and returns the updated invoice even if the notification pipeline throws', async () => {
    websocket.getIO = jest.fn(() => { throw new Error('socket not ready'); });
    NotificationService.prototype.createNotification = jest.fn().mockRejectedValue(new Error('notif down'));

    await expect(invoiceService.sendInvoice(PHARMACY_ID, INVOICE_ID)).resolves.toBeDefined();
    expect(prescriptionRepo.updateStatus).toHaveBeenCalled(); // core state change already happened
  });
});

// ============================================================================
// cancelInvoice
// ============================================================================

describe('cancelInvoice', () => {
  test('throws 404 when not found', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(null);
    await expect(invoiceService.cancelInvoice(PHARMACY_ID, INVOICE_ID)).rejects.toMatchObject({ status: 404 });
  });

  test('refuses to cancel a paid invoice', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeInvoice({ status: 'paid' }));
    await expect(invoiceService.cancelInvoice(PHARMACY_ID, INVOICE_ID))
      .rejects.toMatchObject({ status: 422, message: 'Cannot cancel a paid invoice' });
  });

  test('refuses to cancel an already-cancelled invoice', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeInvoice({ status: 'cancelled' }));
    await expect(invoiceService.cancelInvoice(PHARMACY_ID, INVOICE_ID))
      .rejects.toMatchObject({ status: 422, message: 'Invoice is already cancelled' });
  });

  test('reverts the prescription to under_review only if it was awaiting_payment', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue({ id: PRESCRIPTION_ID, status: 'awaiting_payment' });
    await invoiceService.cancelInvoice(PHARMACY_ID, INVOICE_ID);
    expect(prescriptionRepo.updateStatus).toHaveBeenCalledWith(PRESCRIPTION_ID, 'under_review');
  });

  test('does not touch the prescription status if it was not awaiting_payment', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue({ id: PRESCRIPTION_ID, status: 'in_progress' });
    await invoiceService.cancelInvoice(PHARMACY_ID, INVOICE_ID);
    expect(prescriptionRepo.updateStatus).not.toHaveBeenCalled();
  });
});

// ============================================================================
// markPaid — the money-moving path (immediate wallet credit for cash/POS)
// ============================================================================

describe('markPaid', () => {
  test('throws 404 when invoice not found', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(null);
    await expect(invoiceService.markPaid(PHARMACY_ID, INVOICE_ID)).rejects.toMatchObject({ status: 404 });
  });

  test('rejects when the invoice payment method is not pay_on_pickup', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeInvoice({ paymentMethod: 'online' }));
    await expect(invoiceService.markPaid(PHARMACY_ID, INVOICE_ID)).rejects.toMatchObject({ status: 422 });
  });

  test('refuses to re-mark an already-paid invoice as paid', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(
      makeInvoice({ paymentMethod: 'pay_on_pickup', status: 'paid' })
    );
    await expect(invoiceService.markPaid(PHARMACY_ID, INVOICE_ID))
      .rejects.toMatchObject({ status: 422, message: 'Invoice is already paid' });
  });

  test('refuses to mark a cancelled invoice as paid', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(
      makeInvoice({ paymentMethod: 'pay_on_pickup', status: 'cancelled' })
    );
    await expect(invoiceService.markPaid(PHARMACY_ID, INVOICE_ID)).rejects.toMatchObject({ status: 422 });
  });

  test('creates a wallet for the pharmacy first if none exists yet', async () => {
    pharmacyWalletRepo.findByPharmacyId = jest.fn().mockResolvedValue(null);
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(
      makeInvoice({ paymentMethod: 'pay_on_pickup', status: 'sent' })
    );

    await invoiceService.markPaid(PHARMACY_ID, INVOICE_ID);
    expect(pharmacyWalletRepo.save).toHaveBeenCalledWith(expect.objectContaining({ pharmacyId: PHARMACY_ID }));
  });

  test('credits the wallet with exactly invoice.totalAmountUsd and marks invoice/prescription paid, in one transaction', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(
      makeInvoice({ paymentMethod: 'pay_on_pickup', status: 'sent', totalAmountUsd: '11.0000' })
    );

    await invoiceService.markPaid(PHARMACY_ID, INVOICE_ID);

    const trx = AppDataSource.__getLastTrx();
    expect(trx.__calls.update).toContainEqual(
      expect.objectContaining({ entity: 'Invoice', criteria: { id: INVOICE_ID }, values: expect.objectContaining({ status: 'paid' }) })
    );
    expect(trx.__calls.update).toContainEqual(
      expect.objectContaining({
        entity: 'Prescription',
        criteria: { id: PRESCRIPTION_ID },
        values: { status: 'in_progress', paymentStatus: 'paid' },
      })
    );

    const walletUpdate = trx.__calls.update.find((c) => c.entity === 'PharmacyWallet');
    expect(walletUpdate.values.availableBalanceUsd()).toBe('"availableBalanceUsd" + 11');
    expect(walletUpdate.values.totalEarningsUsd()).toBe('"totalEarningsUsd" + 11');

    const txnSave = trx.__calls.save.find((c) => c.entity === 'PharmacyWalletTransaction');
    expect(txnSave.data).toMatchObject({
      type: 'credit',
      status: 'completed',
      category: 'invoice_payment',
      amountUsd: 11,
      invoiceId: INVOICE_ID,
      patientId: PATIENT_ID,
      prescriptionId: PRESCRIPTION_ID,
    });
  });

  test('still returns successfully even when post-payment notifications throw', async () => {
    invoiceRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(
      makeInvoice({ paymentMethod: 'pay_on_pickup', status: 'sent' })
    );
    websocket.getIO = jest.fn(() => { throw new Error('socket down'); });
    NotificationService.prototype.createNotification = jest.fn().mockRejectedValue(new Error('notif down'));

    await expect(invoiceService.markPaid(PHARMACY_ID, INVOICE_ID)).resolves.toBeDefined();
  });
});
