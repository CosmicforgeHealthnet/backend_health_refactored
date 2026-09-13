/* eslint-env jest */
// Unit tests for pharmacyDisputeService.
//
// Reachability note (checked against src/features/pharmacy/routes/*):
//  - listDisputes / respondToDispute ARE live (walletRoutes.js: GET/POST
//    /api/pharmacy/wallet/disputes...).
//  - raiseDispute is DEAD CODE — patientRoutes.js returns 410 Gone for
//    POST /api/patient/invoices/:id/dispute ("replaced by the prescription
//    cart session system"). Tested anyway since the function is still
//    exported and exercised at the unit level; it is not reachable over HTTP
//    today.
//  - resolveDispute has NO CONTROLLER/ROUTE ANYWHERE in the codebase calling
//    it — grepping the whole src tree finds only its own definition. It is
//    unreachable dead code today, but it is tested because of a real
//    correctness gap found while reading it (see below), so the gap is
//    documented for whoever wires this back up.
//
// BUG OBSERVED (not fixed — see reasoning): resolveDispute's docstring says
// "patient_favour: debit pharmacy wallet, trigger refund", and
// PatientWalletTransaction even has a dedicated REFUND category
// ("credit — dispute refund"). But the implementation only debits the
// pharmacy's wallet — it never credits the patient's wallet or creates any
// PatientWalletTransaction. If this function is ever wired up as-is, a
// patient-favour or split resolution would silently take money away from
// the pharmacy without ever returning it to the patient. Left unfixed here
// because (a) the function has zero live callers so there is no way to
// exercise a fix end-to-end, and (b) the correct fix depends on a product
// decision this task can't make alone (refund to patient wallet vs. reverse
// the original gateway charge). Flagged in the test suite and the final
// report instead of guessing at the intended behavior.

jest.mock('../../../../config/database');
jest.mock('../../repositories/pharmacyDisputeRepository');
jest.mock('../../repositories/invoiceRepository');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('../../../notifications/services/notificationService');
jest.mock('../../../../shared/services/email/helper/pharmacy');
jest.mock('../../../../config/websocket');

const AppDataSource       = require('../../../../config/database');
const pharmacyDisputeRepo = require('../../repositories/pharmacyDisputeRepository');
const invoiceRepo         = require('../../repositories/invoiceRepository');
const userRepo            = require('../../../auth/repositories/userRepository');
const NotificationService = require('../../../notifications/services/notificationService');
const pharmacyEmailHelper = require('../../../../shared/services/email/helper/pharmacy');
const websocket           = require('../../../../config/websocket');

const pharmacyDisputeService = require('../pharmacyDisputeService');

const PHARMACY_ID  = 'aaaa0000-0000-0000-0000-000000000001';
const DISPUTE_ID   = 'bbbb0000-0000-0000-0000-000000000002';
const INVOICE_ID   = 'cccc0000-0000-0000-0000-000000000003';
const PATIENT_ID   = 'dddd0000-0000-0000-0000-000000000004';
const WALLET_ID    = 'eeee0000-0000-0000-0000-000000000005';

function makeDispute(overrides = {}) {
  return {
    id: DISPUTE_ID,
    invoiceId: INVOICE_ID,
    pharmacyId: PHARMACY_ID,
    patientId: PATIENT_ID,
    amountUsd: '20.0000',
    status: 'open',
    resolution: 'pending',
    reason: 'wrong_item',
    description: 'Received the wrong medication',
    raisedBy: 'patient',
    ...overrides,
  };
}

function makeFakeTrx() {
  const calls = { update: [], save: [], findOne: [] };
  return {
    update: jest.fn(async (entity, criteria, values) => { calls.update.push({ entity, criteria, values }); }),
    save: jest.fn(async (entity, data) => { calls.save.push({ entity, data }); return { id: 'x', ...data }; }),
    findOne: jest.fn(async () => ({ id: WALLET_ID, pharmacyId: PHARMACY_ID, availableBalanceUsd: '100.0000', totalEarningsUsd: '500.0000' })),
    __calls: calls,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  let lastTrx;
  AppDataSource.transaction = jest.fn(async (cb) => { lastTrx = makeFakeTrx(); await cb(lastTrx); return lastTrx; });
  AppDataSource.__getLastTrx = () => lastTrx;
  AppDataSource.getRepository = jest.fn(() => ({ findOne: jest.fn().mockResolvedValue(null) }));

  pharmacyDisputeRepo.findByPharmacy = jest.fn().mockResolvedValue({ disputes: [], total: 0 });
  pharmacyDisputeRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeDispute());
  pharmacyDisputeRepo.findById = jest.fn().mockResolvedValue(makeDispute());
  pharmacyDisputeRepo.update = jest.fn().mockResolvedValue(undefined);
  pharmacyDisputeRepo.save = jest.fn().mockImplementation(async (data) => ({ id: DISPUTE_ID, ...data }));
  pharmacyDisputeRepo.hasOpenDispute = jest.fn().mockResolvedValue(false);

  invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue({
    id: INVOICE_ID, pharmacyId: PHARMACY_ID, patientId: PATIENT_ID, reference: '#1',
    status: 'paid', paidAt: new Date().toISOString(), totalAmountUsd: '20.0000',
  });

  userRepo.findById = jest.fn().mockResolvedValue({ id: PATIENT_ID, email: 'patient@example.com', firstName: 'Jane', lastName: 'Doe' });

  NotificationService.prototype.createNotification = jest.fn().mockResolvedValue(undefined);
  pharmacyEmailHelper.sendDisputeRaisedEmail = jest.fn().mockResolvedValue(undefined);
  pharmacyEmailHelper.sendDisputeResolvedEmail = jest.fn().mockResolvedValue(undefined);

  websocket.getIO = jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) }));
});

// ============================================================================
// respondToDispute (live)
// ============================================================================

describe('respondToDispute', () => {
  test('requires a non-empty message', async () => {
    await expect(pharmacyDisputeService.respondToDispute(PHARMACY_ID, DISPUTE_ID, {}))
      .rejects.toMatchObject({ status: 400 });
  });

  test('throws 404 when the dispute does not belong to this pharmacy', async () => {
    pharmacyDisputeRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(null);
    await expect(pharmacyDisputeService.respondToDispute(PHARMACY_ID, DISPUTE_ID, { message: 'hi' }))
      .rejects.toMatchObject({ status: 404 });
  });

  test.each(['resolved', 'closed', 'escalated'])('refuses to respond to a dispute with status "%s"', async (status) => {
    pharmacyDisputeRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeDispute({ status }));
    await expect(pharmacyDisputeService.respondToDispute(PHARMACY_ID, DISPUTE_ID, { message: 'hi' }))
      .rejects.toMatchObject({ status: 422 });
  });

  test('auto-advances an open dispute to under_review when the pharmacy responds', async () => {
    pharmacyDisputeRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeDispute({ status: 'open' }));
    await pharmacyDisputeService.respondToDispute(PHARMACY_ID, DISPUTE_ID, { message: 'We sent the correct item.' });

    expect(pharmacyDisputeRepo.update).toHaveBeenCalledWith(DISPUTE_ID, expect.objectContaining({
      pharmacyResponse: 'We sent the correct item.', status: 'under_review',
    }));
  });

  test('does not change status when the dispute is already under_review', async () => {
    pharmacyDisputeRepo.findByIdAndPharmacy = jest.fn().mockResolvedValue(makeDispute({ status: 'under_review' }));
    await pharmacyDisputeService.respondToDispute(PHARMACY_ID, DISPUTE_ID, { message: 'Update.' });

    const call = pharmacyDisputeRepo.update.mock.calls[0][1];
    expect(call.status).toBeUndefined();
  });
});

// ============================================================================
// raiseDispute (currently unreachable via HTTP — POST /api/patient/invoices/:id/dispute
// returns 410 Gone — but still tested at the unit level)
// ============================================================================

describe('raiseDispute', () => {
  test('requires both reason and description', async () => {
    await expect(pharmacyDisputeService.raiseDispute(PATIENT_ID, INVOICE_ID, { reason: 'x' }))
      .rejects.toMatchObject({ status: 400 });
  });

  test('throws 404 when the invoice does not belong to this patient', async () => {
    invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue(null);
    await expect(pharmacyDisputeService.raiseDispute(PATIENT_ID, INVOICE_ID, { reason: 'x', description: 'y' }))
      .rejects.toMatchObject({ status: 404 });
  });

  test('rejects disputing an invoice that is not paid', async () => {
    invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue({ id: INVOICE_ID, status: 'sent' });
    await expect(pharmacyDisputeService.raiseDispute(PATIENT_ID, INVOICE_ID, { reason: 'x', description: 'y' }))
      .rejects.toMatchObject({ status: 422 });
  });

  test('rejects a dispute raised more than 7 days after payment', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue({
      id: INVOICE_ID, status: 'paid', paidAt: eightDaysAgo,
    });
    await expect(pharmacyDisputeService.raiseDispute(PATIENT_ID, INVOICE_ID, { reason: 'x', description: 'y' }))
      .rejects.toMatchObject({ status: 422, message: 'Dispute window has closed (7 days after payment)' });
  });

  test('allows a dispute raised exactly within the 7-day window', async () => {
    const almostSevenDaysAgo = new Date(Date.now() - 6.9 * 24 * 60 * 60 * 1000).toISOString();
    invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue({
      id: INVOICE_ID, pharmacyId: PHARMACY_ID, status: 'paid', paidAt: almostSevenDaysAgo, totalAmountUsd: '20.0000', reference: '#1',
    });
    await expect(pharmacyDisputeService.raiseDispute(PATIENT_ID, INVOICE_ID, { reason: 'x', description: 'y' }))
      .resolves.toBeDefined();
  });

  test('rejects with 409 when an open dispute already exists for the invoice', async () => {
    pharmacyDisputeRepo.hasOpenDispute = jest.fn().mockResolvedValue(true);
    await expect(pharmacyDisputeService.raiseDispute(PATIENT_ID, INVOICE_ID, { reason: 'x', description: 'y' }))
      .rejects.toMatchObject({ status: 409 });
  });

  test('records the dispute amount from the invoice total, not from user input', async () => {
    invoiceRepo.findByIdAndPatient = jest.fn().mockResolvedValue({
      id: INVOICE_ID, pharmacyId: PHARMACY_ID, patientId: PATIENT_ID, status: 'paid',
      paidAt: new Date().toISOString(), totalAmountUsd: '37.5000', reference: '#1',
    });

    await pharmacyDisputeService.raiseDispute(PATIENT_ID, INVOICE_ID, { reason: 'x', description: 'y' });

    expect(pharmacyDisputeRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      amountUsd: 37.5, status: 'open', resolution: 'pending', raisedBy: 'patient',
    }));
  });

  test('still creates the dispute even if the pharmacy notification pipeline throws', async () => {
    AppDataSource.getRepository = jest.fn(() => ({ findOne: jest.fn().mockRejectedValue(new Error('db down')) }));
    await expect(pharmacyDisputeService.raiseDispute(PATIENT_ID, INVOICE_ID, { reason: 'x', description: 'y' }))
      .resolves.toBeDefined();
  });
});

// ============================================================================
// resolveDispute (currently unreachable — no route/controller calls it)
// ============================================================================

describe('resolveDispute', () => {
  test('rejects an invalid or "pending" resolution value', async () => {
    await expect(pharmacyDisputeService.resolveDispute(DISPUTE_ID, { resolution: 'bogus' }))
      .rejects.toMatchObject({ status: 400 });
    await expect(pharmacyDisputeService.resolveDispute(DISPUTE_ID, { resolution: 'pending' }))
      .rejects.toMatchObject({ status: 400 });
  });

  test('throws 404 when the dispute does not exist', async () => {
    pharmacyDisputeRepo.findById = jest.fn().mockResolvedValue(null);
    await expect(pharmacyDisputeService.resolveDispute(DISPUTE_ID, { resolution: 'pharmacy_favour' }))
      .rejects.toMatchObject({ status: 404 });
  });

  test.each(['resolved', 'closed'])('refuses to re-resolve a dispute already in status "%s"', async (status) => {
    pharmacyDisputeRepo.findById = jest.fn().mockResolvedValue(makeDispute({ status }));
    await expect(pharmacyDisputeService.resolveDispute(DISPUTE_ID, { resolution: 'pharmacy_favour' }))
      .rejects.toMatchObject({ status: 422 });
  });

  test('pharmacy_favour takes no wallet action and resolves directly via the repo (no transaction)', async () => {
    await pharmacyDisputeService.resolveDispute(DISPUTE_ID, { resolution: 'pharmacy_favour' });

    expect(AppDataSource.transaction).not.toHaveBeenCalled();
    expect(pharmacyDisputeRepo.update).toHaveBeenCalledWith(DISPUTE_ID, expect.objectContaining({
      status: 'resolved', resolution: 'pharmacy_favour',
    }));
  });

  test('patient_favour debits the pharmacy wallet by the full dispute amount', async () => {
    pharmacyDisputeRepo.findById = jest.fn().mockResolvedValue(makeDispute({ amountUsd: '20.0000' }));

    await pharmacyDisputeService.resolveDispute(DISPUTE_ID, { resolution: 'patient_favour' });

    const trx = AppDataSource.__getLastTrx();
    const walletUpdate = trx.__calls.update.find((c) => c.entity === 'PharmacyWallet');
    expect(walletUpdate.values.availableBalanceUsd()).toBe('GREATEST("availableBalanceUsd" - 20, 0)');

    const txnSave = trx.__calls.save.find((c) => c.entity === 'PharmacyWalletTransaction');
    expect(txnSave.data).toMatchObject({ type: 'debit', status: 'completed', category: 'dispute_reversal', amountUsd: 20 });

    expect(trx.__calls.update).toContainEqual(
      expect.objectContaining({ entity: 'PharmacyDispute', criteria: { id: DISPUTE_ID }, values: expect.objectContaining({ status: 'resolved', resolution: 'patient_favour' }) })
    );

    // GAP: nothing here credits the patient back. See file-header note.
    expect(trx.__calls.save.some((c) => c.entity === 'PatientWalletTransaction')).toBe(false);
  });

  test('split uses the provided splitAmount when given', async () => {
    pharmacyDisputeRepo.findById = jest.fn().mockResolvedValue(makeDispute({ amountUsd: '20.0000' }));
    await pharmacyDisputeService.resolveDispute(DISPUTE_ID, { resolution: 'split', splitAmount: 8 });

    const trx = AppDataSource.__getLastTrx();
    const walletUpdate = trx.__calls.update.find((c) => c.entity === 'PharmacyWallet');
    expect(walletUpdate.values.availableBalanceUsd()).toBe('GREATEST("availableBalanceUsd" - 8, 0)');
  });

  test('split defaults to half the dispute amount when no splitAmount is given', async () => {
    pharmacyDisputeRepo.findById = jest.fn().mockResolvedValue(makeDispute({ amountUsd: '20.0000' }));
    await pharmacyDisputeService.resolveDispute(DISPUTE_ID, { resolution: 'split' });

    const trx = AppDataSource.__getLastTrx();
    const walletUpdate = trx.__calls.update.find((c) => c.entity === 'PharmacyWallet');
    expect(walletUpdate.values.availableBalanceUsd()).toBe('GREATEST("availableBalanceUsd" - 10, 0)');
  });

  test('does nothing to the wallet if the pharmacy has none, but still resolves the dispute', async () => {
    const trxNoWallet = {
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(null),
    };
    AppDataSource.transaction = jest.fn(async (cb) => { await cb(trxNoWallet); });

    await pharmacyDisputeService.resolveDispute(DISPUTE_ID, { resolution: 'patient_favour' });

    expect(trxNoWallet.save).not.toHaveBeenCalled();
    expect(trxNoWallet.update).toHaveBeenCalledWith('PharmacyDispute', { id: DISPUTE_ID }, expect.objectContaining({ status: 'resolved' }));
  });

  test('still resolves successfully even when post-resolution notifications throw', async () => {
    NotificationService.prototype.createNotification = jest.fn().mockRejectedValue(new Error('notif down'));
    await expect(pharmacyDisputeService.resolveDispute(DISPUTE_ID, { resolution: 'pharmacy_favour' }))
      .resolves.toBeDefined();
  });
});
