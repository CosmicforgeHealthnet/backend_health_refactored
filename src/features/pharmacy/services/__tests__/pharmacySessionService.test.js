/* eslint-env jest */
// Unit tests for pharmacySessionService — the prescription cart / session
// system that REPLACED the invoice-based payment flow end-to-end
// (src/features/pharmacy/routes/patientRoutes.js and invoiceRoutes.js return
// 410 Gone for the old invoice endpoints and point here instead). This is
// the actual live pharmacy checkout path today, so it gets Tier-1 scrutiny
// despite being originally scoped as Tier 2.
//
// TWO REAL BUGS FOUND & FIXED in handleCartPaymentSuccess (both in the
// wallet-credit block, src/features/pharmacy/services/pharmacySessionService.js):
//
// 1) Lost-update / concurrency bug: the old code read the wallet
//    (`pendingClearanceUsd`/`totalEarningsUsd`) into JS, added the payment
//    amount, and wrote the sum back as a literal number:
//      pendingClearanceUsd: parseFloat(wallet.pendingClearanceUsd || 0) + pharmacyAmountUsd
//    Every other wallet-credit site in this codebase (pharmacyWalletService,
//    pharmacyPaymentService) instead uses an atomic SQL update expression
//    (`() => \`"pendingClearanceUsd" + ${amount}\``) specifically so two
//    concurrent credits to the same pharmacy wallet (two patients paying for
//    two different carts at nearly the same time — an entirely normal
//    occurrence, not an edge case) can't race and have one overwrite the
//    other's read. Fixed to use the same atomic-expression pattern.
//
// 2) The PharmacyWalletTransaction row this function creates never set
//    `balanceAfterUsd`, which is `nullable: false` on the entity
//    (PharmacyWalletTransaction.js:52). In the real (non-mocked) database
//    this insert would violate the NOT-NULL constraint and throw *inside*
//    the AppDataSource.transaction callback, rolling back the entire
//    transaction — meaning the cart/session/prescription status flips to
//    "paid"/"approved"/"in_progress" would ALSO roll back. Concretely: the
//    current live pharmacy checkout flow could 500 and undo the patient's
//    successful payment confirmation on every single order. Fixed by
//    re-reading the wallet after the atomic update and setting
//    balanceAfterUsd from it, matching the pattern used everywhere else.
//
// THIRD BUG FIXED (approveAndPay, minor/cosmetic): the status guards were
// ordered so that `if (session.status !== "cart_ready") throw "not ready
// yet"` ran before `if (session.status === "approved") throw "already
// approved"` — since "approved" is also != "cart_ready", the second check
// was unreachable dead code and an already-paid session always got the
// generic "not ready yet" message instead of "already approved and paid".
// Reordered so the more specific message wins.

jest.mock('../../../../config/database');
jest.mock('../../repositories/sessionRepository');
jest.mock('../../repositories/prescriptionCartRepository');
jest.mock('../../../notifications/services/notificationService');
jest.mock('../../../payments/services/currencyService');
jest.mock('../../../admin-ops/services/platformConfigService');
jest.mock('../../../../config/websocket');
jest.mock('axios');

const AppDataSource       = require('../../../../config/database');
const sessionRepository   = require('../../repositories/sessionRepository');
const cartRepository      = require('../../repositories/prescriptionCartRepository');
const NotificationService = require('../../../notifications/services/notificationService');
const CurrencyService     = require('../../../payments/services/currencyService');
const platformConfigService = require('../../../admin-ops/services/platformConfigService');
const websocket           = require('../../../../config/websocket');
const axios = require('axios');

const pharmacySessionService = require('../pharmacySessionService');

const PATIENT_ID  = 'aaaa0000-0000-0000-0000-000000000001';
const PHARMACY_ID = 'bbbb0000-0000-0000-0000-000000000002';
const PRESCRIPTION_ID = 'cccc0000-0000-0000-0000-000000000003';
const SESSION_ID  = 'dddd0000-0000-0000-0000-000000000004';
const CART_ID     = 'eeee0000-0000-0000-0000-000000000005';
const WALLET_ID   = 'ffff0000-0000-0000-0000-000000000006';

function makeCart(overrides = {}) {
  return {
    id: CART_ID, sessionId: SESSION_ID, prescriptionId: PRESCRIPTION_ID,
    pharmacyId: PHARMACY_ID, patientId: PATIENT_ID,
    status: 'building', paymentStatus: 'unpaid', currency: 'NGN',
    items: [],
    ...overrides,
  };
}

function makeSession(overrides = {}) {
  return {
    id: SESSION_ID, prescriptionId: PRESCRIPTION_ID, pharmacyId: PHARMACY_ID, patientId: PATIENT_ID,
    status: 'active', expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    cart: makeCart(),
    ...overrides,
  };
}

function makeFakeTrx() {
  const calls = { update: [], save: [], findOne: [] };
  const qb = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue(undefined) };
  return {
    update: jest.fn(async (entity, criteria, values) => { calls.update.push({ entity, criteria, values }); }),
    save: jest.fn(async (entity, data) => { calls.save.push({ entity, data }); return { id: 'x', ...data }; }),
    findOne: jest.fn(async (entity) => ({ id: WALLET_ID, pharmacyId: PHARMACY_ID, pendingClearanceUsd: '0.0000', totalEarningsUsd: '0.0000' })),
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

  const repoStubs = {
    Prescription: { findOne: jest.fn().mockResolvedValue({ id: PRESCRIPTION_ID, patientId: PATIENT_ID }) },
    User: { findOne: jest.fn().mockResolvedValue({ id: PATIENT_ID, email: 'patient@example.com', fullName: 'Jane Doe' }) },
    PrescriptionCartItem: { find: jest.fn().mockResolvedValue([]) },
    PrescriptionCart: { findOne: jest.fn().mockResolvedValue({ id: CART_ID, sessionId: SESSION_ID }) },
    PharmacySession: { findOne: jest.fn().mockResolvedValue({ id: SESSION_ID }) },
  };
  AppDataSource.getRepository = jest.fn((name) => repoStubs[name] || { findOne: jest.fn().mockResolvedValue(null), find: jest.fn().mockResolvedValue([]) });
  AppDataSource.__repoStubs = repoStubs;

  sessionRepository.findExisting = jest.fn().mockResolvedValue(null);
  sessionRepository.save = jest.fn().mockImplementation(async (data) => ({ id: SESSION_ID, ...data }));
  sessionRepository.findById = jest.fn().mockResolvedValue(makeSession());
  sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(makeSession());
  sessionRepository.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeSession());
  sessionRepository.findByPatientPaginated = jest.fn().mockResolvedValue({ sessions: [], total: 0, page: 1, limit: 20 });
  sessionRepository.findByPharmacyPaginated = jest.fn().mockResolvedValue({ sessions: [], total: 0, page: 1, limit: 20 });
  sessionRepository.update = jest.fn().mockResolvedValue(undefined);

  cartRepository.save = jest.fn().mockImplementation(async (data) => ({ id: CART_ID, ...data }));
  cartRepository.update = jest.fn().mockResolvedValue(undefined);
  cartRepository.saveItem = jest.fn().mockResolvedValue(undefined);
  cartRepository.findItemById = jest.fn().mockResolvedValue(null);
  cartRepository.deleteItem = jest.fn().mockResolvedValue(undefined);
  cartRepository.findBySessionId = jest.fn().mockResolvedValue(makeCart());

  NotificationService.prototype.createNotification = jest.fn().mockResolvedValue(undefined);
  CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ NGN: 1500 });
  platformConfigService.getPlatformFeeRate = jest.fn().mockResolvedValue(0.07);
  websocket.getIO = jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) }));

  axios.post = jest.fn().mockResolvedValue({ data: { data: { authorization_url: 'https://pay.example/x', link: 'https://flw.example/y' } } });

  process.env.PAYSTACK_SECRET_KEY = 'sk_test';
  process.env.FLUTTERWAVE_SECRET_KEY = 'flw_test';
  delete process.env.DEFAULT_PAYMENT_PROVIDER;
});

// ============================================================================
// startSession
// ============================================================================

describe('startSession', () => {
  test('requires prescriptionId and pharmacyId', async () => {
    await expect(pharmacySessionService.startSession(PATIENT_ID, {})).rejects.toThrow('prescriptionId and pharmacyId are required');
  });

  test('throws when the prescription does not belong to this patient', async () => {
    AppDataSource.__repoStubs.Prescription.findOne = jest.fn().mockResolvedValue(null);
    await expect(pharmacySessionService.startSession(PATIENT_ID, { prescriptionId: PRESCRIPTION_ID, pharmacyId: PHARMACY_ID }))
      .rejects.toThrow('Prescription not found');
  });

  test('refuses a duplicate active session with the same pharmacy for the same prescription', async () => {
    sessionRepository.findExisting = jest.fn().mockResolvedValue({ id: 'existing-session' });
    await expect(pharmacySessionService.startSession(PATIENT_ID, { prescriptionId: PRESCRIPTION_ID, pharmacyId: PHARMACY_ID }))
      .rejects.toThrow('You already have an active session with this pharmacy for this prescription');
  });

  test('creates a session and an empty building cart', async () => {
    await pharmacySessionService.startSession(PATIENT_ID, { prescriptionId: PRESCRIPTION_ID, pharmacyId: PHARMACY_ID });

    expect(sessionRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      prescriptionId: PRESCRIPTION_ID, pharmacyId: PHARMACY_ID, patientId: PATIENT_ID, status: 'active',
    }));
    expect(cartRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: SESSION_ID, status: 'building', paymentStatus: 'unpaid', currency: 'NGN',
    }));
  });
});

// ============================================================================
// approveAndPay — guard ordering + payment initiation
// ============================================================================

describe('approveAndPay', () => {
  test('throws when the session does not belong to this patient', async () => {
    sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(null);
    await expect(pharmacySessionService.approveAndPay(PATIENT_ID, SESSION_ID)).rejects.toThrow('Session not found');
  });

  test('reports "already approved and paid" (not the generic "not ready" message) for an approved session', async () => {
    sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(makeSession({ status: 'approved' }));
    await expect(pharmacySessionService.approveAndPay(PATIENT_ID, SESSION_ID))
      .rejects.toThrow('Session is already approved and paid.');
  });

  test('reports expiry distinctly from "not ready"', async () => {
    sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(
      makeSession({ status: 'active', expiresAt: new Date(Date.now() - 1000) })
    );
    await expect(pharmacySessionService.approveAndPay(PATIENT_ID, SESSION_ID))
      .rejects.toThrow('Session has expired. Please start a new session.');
  });

  test('refuses payment while the cart is still being built', async () => {
    sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(makeSession({ status: 'active' }));
    await expect(pharmacySessionService.approveAndPay(PATIENT_ID, SESSION_ID))
      .rejects.toThrow('Cart is not ready for payment yet. Wait for the pharmacy to finalise.');
  });

  test('refuses when the cart has no total', async () => {
    sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(
      makeSession({ status: 'cart_ready', cart: makeCart({ status: 'ready', totalAmountNgn: null }) })
    );
    await expect(pharmacySessionService.approveAndPay(PATIENT_ID, SESSION_ID)).rejects.toThrow('Cart has no items or total');
  });

  test('refuses when the cart has already been paid', async () => {
    sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(
      makeSession({ status: 'cart_ready', cart: makeCart({ totalAmountNgn: '1000.0000', paymentStatus: 'paid' }) })
    );
    await expect(pharmacySessionService.approveAndPay(PATIENT_ID, SESSION_ID)).rejects.toThrow('Cart has already been paid');
  });

  test('returns the existing authorization URL without re-initiating payment when one is already pending', async () => {
    sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(
      makeSession({
        status: 'cart_ready',
        cart: makeCart({
          totalAmountNgn: '1000.0000', platformFeeNgn: '70.0000', paymentStatus: 'unpaid',
          paymentAuthUrl: 'https://pay.example/existing', paymentReference: 'REF-1',
        }),
      })
    );

    const result = await pharmacySessionService.approveAndPay(PATIENT_ID, SESSION_ID);

    expect(result).toMatchObject({
      paymentUrl: 'https://pay.example/existing', amount: 1000, platformFeeAmount: 70, grossAmount: 1070,
    });
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('initiates a new payment (paystack default) with base+7% fee gross amount', async () => {
    sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(
      makeSession({
        status: 'cart_ready',
        cart: makeCart({ totalAmountNgn: '1000.0000', platformFeeNgn: '70.0000', paymentStatus: 'unpaid' }),
      })
    );

    const result = await pharmacySessionService.approveAndPay(PATIENT_ID, SESSION_ID);

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.paystack.co/transaction/initialize',
      expect.objectContaining({ amount: 107000 }), // (1000+70) NGN * 100 kobo
      expect.any(Object)
    );
    expect(result).toMatchObject({ amount: 1000, platformFeeAmount: 70, grossAmount: 1070, currency: 'NGN' });
  });

  test('stores the pharmacy USD amount converted at the live NGN rate, unaffected by the platform fee', async () => {
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ NGN: 1000 }); // 1000 NGN = 1 USD
    sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(
      makeSession({
        status: 'cart_ready',
        cart: makeCart({ totalAmountNgn: '5000.0000', platformFeeNgn: '350.0000', paymentStatus: 'unpaid' }),
      })
    );

    await pharmacySessionService.approveAndPay(PATIENT_ID, SESSION_ID);

    expect(cartRepository.update).toHaveBeenCalledWith(CART_ID, expect.objectContaining({
      totalAmountUsd: 5,       // 5000 / 1000
      pharmacyAmountUsd: 5,    // pharmacy gets the full base, not gross
    }));
  });

  test('uses flutterwave when DEFAULT_PAYMENT_PROVIDER=flutterwave', async () => {
    process.env.DEFAULT_PAYMENT_PROVIDER = 'flutterwave';
    sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(
      makeSession({
        status: 'cart_ready',
        cart: makeCart({ totalAmountNgn: '1000.0000', platformFeeNgn: '70.0000', paymentStatus: 'unpaid' }),
      })
    );

    await pharmacySessionService.approveAndPay(PATIENT_ID, SESSION_ID);

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.flutterwave.com/v3/payments',
      expect.objectContaining({ amount: 1070 }),
      expect.any(Object)
    );
  });
});

// ============================================================================
// cancelSession (patient) / cancelSessionByPharmacy
// ============================================================================

describe('cancelSession (patient)', () => {
  test('throws when session not found', async () => {
    sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(null);
    await expect(pharmacySessionService.cancelSession(PATIENT_ID, SESSION_ID)).rejects.toThrow('Session not found');
  });

  test.each(['approved', 'cancelled', 'expired'])('refuses to cancel a session in terminal status "%s"', async (status) => {
    sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(makeSession({ status }));
    await expect(pharmacySessionService.cancelSession(PATIENT_ID, SESSION_ID)).rejects.toThrow('Session cannot be cancelled');
  });

  test('refuses to cancel a session whose cart is already paid', async () => {
    sessionRepository.findByIdAndPatient = jest.fn().mockResolvedValue(
      makeSession({ status: 'cart_ready', cart: makeCart({ paymentStatus: 'paid' }) })
    );
    await expect(pharmacySessionService.cancelSession(PATIENT_ID, SESSION_ID)).rejects.toThrow('Cannot cancel a paid session');
  });

  test('cancels an active, unpaid session', async () => {
    await pharmacySessionService.cancelSession(PATIENT_ID, SESSION_ID);
    expect(sessionRepository.update).toHaveBeenCalledWith(SESSION_ID, { status: 'cancelled' });
  });
});

describe('cancelSessionByPharmacy', () => {
  test('throws when session not found', async () => {
    sessionRepository.findByIdAndPharmacy = jest.fn().mockResolvedValue(null);
    await expect(pharmacySessionService.cancelSessionByPharmacy(PHARMACY_ID, SESSION_ID)).rejects.toThrow('Session not found');
  });

  test.each(['approved', 'cancelled', 'expired'])('refuses to cancel a session in terminal status "%s"', async (status) => {
    sessionRepository.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeSession({ status }));
    await expect(pharmacySessionService.cancelSessionByPharmacy(PHARMACY_ID, SESSION_ID)).rejects.toThrow('Session cannot be cancelled');
  });

  test('cancels an active session', async () => {
    sessionRepository.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeSession({ status: 'active' }));
    await pharmacySessionService.cancelSessionByPharmacy(PHARMACY_ID, SESSION_ID);
    expect(sessionRepository.update).toHaveBeenCalledWith(SESSION_ID, { status: 'cancelled' });
  });
});

// ============================================================================
// addCartItem / removeCartItem / finaliseCart
// ============================================================================

describe('addCartItem', () => {
  test.each([
    [{ quantity: 1, unitPriceNgn: 100 }, 'productName, quantity, and unitPriceNgn are required'],
    [{ productName: 'X', unitPriceNgn: 100 }, 'productName, quantity, and unitPriceNgn are required'],
    // quantity/unitPriceNgn of 0 are falsy, so they're caught by the
    // combined "required" guard above rather than the more specific
    // `quantity < 1` / `unitPriceNgn <= 0` checks below it (dead for 0,
    // reachable only for negative values) — still correctly rejected either way.
    [{ productName: 'X', quantity: 0, unitPriceNgn: 100 }, 'productName, quantity, and unitPriceNgn are required'],
    [{ productName: 'X', quantity: 1, unitPriceNgn: 0 }, 'productName, quantity, and unitPriceNgn are required'],
    [{ productName: 'X', quantity: -1, unitPriceNgn: 100 }, 'quantity must be at least 1'],
    [{ productName: 'X', quantity: 1, unitPriceNgn: -5 }, 'unitPriceNgn must be greater than 0'],
  ])('validates required fields: %j', async (body, expectedMessage) => {
    await expect(pharmacySessionService.addCartItem(PHARMACY_ID, SESSION_ID, body)).rejects.toThrow(expectedMessage);
  });

  test('throws when session not found for this pharmacy', async () => {
    sessionRepository.findByIdAndPharmacy = jest.fn().mockResolvedValue(null);
    await expect(pharmacySessionService.addCartItem(PHARMACY_ID, SESSION_ID, { productName: 'X', quantity: 1, unitPriceNgn: 100 }))
      .rejects.toThrow('Session not found');
  });

  test('refuses to add items to a non-active session', async () => {
    sessionRepository.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeSession({ status: 'cart_ready' }));
    await expect(pharmacySessionService.addCartItem(PHARMACY_ID, SESSION_ID, { productName: 'X', quantity: 1, unitPriceNgn: 100 }))
      .rejects.toThrow('Can only add items to an active session');
  });

  test('computes totalPriceNgn as unitPrice * quantity and recalculates the cart with the 7% platform fee', async () => {
    sessionRepository.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeSession({ status: 'active' }));
    AppDataSource.__repoStubs.PrescriptionCartItem.find = jest.fn().mockResolvedValue([
      { totalPriceNgn: '2000.0000' },
    ]);

    await pharmacySessionService.addCartItem(PHARMACY_ID, SESSION_ID, {
      productName: 'Panadol', quantity: 2, unitPriceNgn: 1000,
    });

    expect(cartRepository.saveItem).toHaveBeenCalledWith(expect.objectContaining({
      cartId: CART_ID, productName: 'Panadol', quantity: 2, unitPriceNgn: 1000, totalPriceNgn: 2000,
    }));
    expect(cartRepository.update).toHaveBeenCalledWith(CART_ID, {
      totalAmountNgn: 2000, platformFeeNgn: 140, pharmacyAmountNgn: 2000,
    });
  });
});

describe('removeCartItem', () => {
  test('throws when the item does not belong to this session\'s cart', async () => {
    sessionRepository.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeSession({ status: 'active' }));
    cartRepository.findItemById = jest.fn().mockResolvedValue({ id: 'item-1', cartId: 'some-other-cart' });

    await expect(pharmacySessionService.removeCartItem(PHARMACY_ID, SESSION_ID, 'item-1')).rejects.toThrow('Item not found');
    expect(cartRepository.deleteItem).not.toHaveBeenCalled();
  });

  test('deletes the item and recalculates the cart total', async () => {
    sessionRepository.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeSession({ status: 'active' }));
    cartRepository.findItemById = jest.fn().mockResolvedValue({ id: 'item-1', cartId: CART_ID });

    await pharmacySessionService.removeCartItem(PHARMACY_ID, SESSION_ID, 'item-1');

    expect(cartRepository.deleteItem).toHaveBeenCalledWith('item-1');
    expect(cartRepository.update).toHaveBeenCalledWith(CART_ID, expect.objectContaining({ totalAmountNgn: 0 }));
  });
});

describe('finaliseCart', () => {
  test('throws when the session is not active', async () => {
    sessionRepository.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeSession({ status: 'cart_ready' }));
    await expect(pharmacySessionService.finaliseCart(PHARMACY_ID, SESSION_ID)).rejects.toThrow('Session is no longer active');
  });

  test('refuses to finalise an empty cart', async () => {
    sessionRepository.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeSession({ status: 'active' }));
    cartRepository.findBySessionId = jest.fn().mockResolvedValue(makeCart({ items: [] }));
    await expect(pharmacySessionService.finaliseCart(PHARMACY_ID, SESSION_ID)).rejects.toThrow('Cart must have at least one item');
  });

  test('marks the cart ready and the session cart_ready', async () => {
    sessionRepository.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeSession({ status: 'active' }));
    cartRepository.findBySessionId = jest.fn().mockResolvedValue(makeCart({ items: [{ id: 'i1' }] }));

    await pharmacySessionService.finaliseCart(PHARMACY_ID, SESSION_ID, { pharmacyNote: 'Ready for pickup' });

    expect(cartRepository.update).toHaveBeenCalledWith(CART_ID, { status: 'ready', pharmacyNote: 'Ready for pickup' });
    expect(sessionRepository.update).toHaveBeenCalledWith(SESSION_ID, { status: 'cart_ready' });
  });
});

// ============================================================================
// handleCartPaymentSuccess — the webhook-driven money-moving transaction
// (this is where the two real bugs were found and fixed)
// ============================================================================

describe('handleCartPaymentSuccess', () => {
  test('throws when the cart cannot be resolved', async () => {
    AppDataSource.__repoStubs.PrescriptionCart.findOne = jest.fn().mockResolvedValue(null);
    cartRepository.findBySessionId = jest.fn().mockResolvedValue(null);
    await expect(pharmacySessionService.handleCartPaymentSuccess(CART_ID)).rejects.toThrow('Prescription cart not found');
  });

  test('is idempotent when the cart is already paid (duplicate webhook)', async () => {
    cartRepository.findBySessionId = jest.fn().mockResolvedValue(makeCart({ paymentStatus: 'paid' }));
    await pharmacySessionService.handleCartPaymentSuccess(CART_ID);
    expect(AppDataSource.transaction).not.toHaveBeenCalled();
  });

  test('marks cart paid/approved, session approved, and prescription in_progress/paid', async () => {
    cartRepository.findBySessionId = jest.fn().mockResolvedValue(
      makeCart({ paymentStatus: 'unpaid', totalAmountUsd: '10.0000' })
    );

    await pharmacySessionService.handleCartPaymentSuccess(CART_ID);

    const trx = AppDataSource.__getLastTrx();
    expect(trx.__calls.update).toContainEqual(
      expect.objectContaining({ entity: 'PrescriptionCart', criteria: { id: CART_ID }, values: expect.objectContaining({ paymentStatus: 'paid', status: 'approved' }) })
    );
    expect(trx.__calls.update).toContainEqual(
      expect.objectContaining({ entity: 'PharmacySession', criteria: { id: SESSION_ID }, values: { status: 'approved' } })
    );
    expect(trx.__calls.update).toContainEqual(
      expect.objectContaining({ entity: 'Prescription', criteria: { id: PRESCRIPTION_ID }, values: { status: 'in_progress', paymentStatus: 'paid', paymentMethod: 'online' } })
    );
  });

  test('BUGFIX: credits the wallet using an atomic SQL expression, not a JS-computed literal from a stale read', async () => {
    cartRepository.findBySessionId = jest.fn().mockResolvedValue(
      makeCart({ paymentStatus: 'unpaid', totalAmountUsd: '10.0000' })
    );

    await pharmacySessionService.handleCartPaymentSuccess(CART_ID);

    const trx = AppDataSource.__getLastTrx();
    const walletUpdate = trx.__calls.update.find((c) => c.entity === 'PharmacyWallet');
    expect(walletUpdate).toBeDefined();
    // Must be a function producing a raw SQL fragment (atomic increment),
    // not a plain number — a plain number here is exactly the lost-update
    // bug that was fixed.
    expect(typeof walletUpdate.values.pendingClearanceUsd).toBe('function');
    expect(walletUpdate.values.pendingClearanceUsd()).toBe('"pendingClearanceUsd" + 10');
    expect(typeof walletUpdate.values.totalEarningsUsd).toBe('function');
    expect(walletUpdate.values.totalEarningsUsd()).toBe('"totalEarningsUsd" + 10');
  });

  test('BUGFIX: the wallet transaction ledger row includes balanceAfterUsd (NOT NULL on the entity)', async () => {
    cartRepository.findBySessionId = jest.fn().mockResolvedValue(
      makeCart({ paymentStatus: 'unpaid', totalAmountUsd: '10.0000' })
    );

    await pharmacySessionService.handleCartPaymentSuccess(CART_ID);

    const trx = AppDataSource.__getLastTrx();
    const txnSave = trx.__calls.save.find((c) => c.entity === 'PharmacyWalletTransaction');
    expect(txnSave).toBeDefined();
    expect(txnSave.data.balanceAfterUsd).toBeDefined();
    expect(typeof txnSave.data.balanceAfterUsd).toBe('number');
    expect(txnSave.data).toMatchObject({ type: 'credit', category: 'invoice_payment', status: 'pending', amountUsd: 10 });
  });

  test('does not attempt a wallet credit when the pharmacy has no earnings to credit (zero amount)', async () => {
    cartRepository.findBySessionId = jest.fn().mockResolvedValue(
      makeCart({ paymentStatus: 'unpaid', totalAmountUsd: '0', pharmacyAmountUsd: '0' })
    );

    await pharmacySessionService.handleCartPaymentSuccess(CART_ID);

    const trx = AppDataSource.__getLastTrx();
    expect(trx.__calls.update.some((c) => c.entity === 'PharmacyWallet')).toBe(false);
  });

  test('cancels other active/cart_ready sessions for the same prescription', async () => {
    cartRepository.findBySessionId = jest.fn().mockResolvedValue(
      makeCart({ paymentStatus: 'unpaid', totalAmountUsd: '10.0000' })
    );

    await pharmacySessionService.handleCartPaymentSuccess(CART_ID);

    const trx = AppDataSource.__getLastTrx();
    expect(trx.__qb.where).toHaveBeenCalledWith(
      "prescriptionId = :prescriptionId AND id != :sessionId AND status IN ('active','cart_ready')",
      { prescriptionId: PRESCRIPTION_ID, sessionId: SESSION_ID }
    );
  });

  test('does not throw when post-commit notifications fail', async () => {
    cartRepository.findBySessionId = jest.fn().mockResolvedValue(
      makeCart({ paymentStatus: 'unpaid', totalAmountUsd: '10.0000' })
    );
    NotificationService.prototype.createNotification = jest.fn().mockRejectedValue(new Error('notif down'));
    websocket.getIO = jest.fn(() => { throw new Error('socket down'); });

    await expect(pharmacySessionService.handleCartPaymentSuccess(CART_ID)).resolves.toBeUndefined();
  });
});
