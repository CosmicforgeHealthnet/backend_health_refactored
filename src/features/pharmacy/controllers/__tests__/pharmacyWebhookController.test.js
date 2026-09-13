/* eslint-env jest */
// Unit tests for PharmacyWebhookController — routes Paystack/Flutterwave
// payment-gateway events to the right service handler (wallet top-up,
// prescription-cart payment, or invoice payment) and to transfer
// success/failure handling for payouts.
//
// NOTE on signature verification: unlike vendor's promotionWebhookController,
// this controller does NOT verify the webhook signature itself — that lives
// in the route file (src/features/pharmacy/routes/pharmacyWebhookRoutes.js,
// verifyPaystackSignature/verifyFlutterwaveSignature middleware) and runs
// before this controller. handleWebhook's own contract per its doc comment
// is "Signature is already verified by middleware before this controller
// runs." So there is no signature logic to unit-test here; idempotency for
// the wallet-topup path is enforced in patientWalletService (already
// covered by patientWalletService.test.js's markCompletedIfPending tests),
// not in this controller. What IS this controller's own job — and what these
// tests target — is: acknowledging receipt immediately (200 before any
// processing), and correctly routing each event's payload to the right
// downstream handler without crashing on missing/malformed fields.

jest.mock('../../services/pharmacyPaymentService');
jest.mock('../../repositories/pharmacyPaymentRepository');
jest.mock('../../services/patientWalletService');
jest.mock('../../services/pharmacySessionService');

const pharmacyPaymentService = require('../../services/pharmacyPaymentService');
const pharmacyPaymentRepo    = require('../../repositories/pharmacyPaymentRepository');
const patientWalletService   = require('../../services/patientWalletService');
const pharmacySessionService = require('../../services/pharmacySessionService');

const pharmacyWebhookController = require('../pharmacyWebhookController');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// Flush the microtask queue so the fire-and-forget processing inside
// handleWebhook (which runs after the immediate res.json(200) response)
// has a chance to complete before assertions run.
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  pharmacyPaymentService.handlePaymentSuccess  = jest.fn().mockResolvedValue(undefined);
  pharmacyPaymentService.handleTransferSuccess = jest.fn().mockResolvedValue(undefined);
  pharmacyPaymentService.handleTransferFailed  = jest.fn().mockResolvedValue(undefined);
  pharmacyPaymentRepo.findByReference          = jest.fn().mockResolvedValue({ id: 'payment-1' });
  patientWalletService.handleTopUpSuccess      = jest.fn().mockResolvedValue(undefined);
  pharmacySessionService.handleCartPaymentSuccess = jest.fn().mockResolvedValue(undefined);
});

// ============================================================================
// handleWebhook — acknowledges immediately regardless of downstream outcome
// ============================================================================

describe('handleWebhook', () => {
  test('responds 200 { received: true } synchronously before any processing happens', async () => {
    const req = { params: { provider: 'paystack' }, body: { event: 'charge.success', data: { reference: 'ref-1', metadata: { type: 'wallet_topup' } } } };
    const res = makeRes();

    const p = pharmacyWebhookController.handleWebhook(req, res);
    // The response should already be sent before the returned promise settles.
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    await p;
  });

  test('an unknown provider sends 200 but performs no processing', async () => {
    const req = { params: { provider: 'unknown-gateway' }, body: { event: 'charge.success', data: {} } };
    const res = makeRes();

    await pharmacyWebhookController.handleWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(pharmacyPaymentService.handlePaymentSuccess).not.toHaveBeenCalled();
  });

  test('does not throw when the downstream handler rejects (errors are swallowed after the 200 is sent)', async () => {
    patientWalletService.handleTopUpSuccess = jest.fn().mockRejectedValue(new Error('DB down'));
    const req = {
      params: { provider: 'paystack' },
      body: { event: 'charge.success', data: { reference: 'ref-1', metadata: { type: 'wallet_topup' } } },
    };
    const res = makeRes();

    await expect(pharmacyWebhookController.handleWebhook(req, res)).resolves.toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ============================================================================
// Paystack — charge.success routing
// ============================================================================

describe('Paystack charge.success routing', () => {
  test('routes wallet_topup metadata to patientWalletService, not the invoice path', async () => {
    const req = {
      params: { provider: 'paystack' },
      body: { event: 'charge.success', data: { reference: 'wallet-ref-1', metadata: { type: 'wallet_topup' } } },
    };
    await pharmacyWebhookController.handleWebhook(req, makeRes());

    expect(patientWalletService.handleTopUpSuccess).toHaveBeenCalledWith('wallet-ref-1');
    expect(pharmacyPaymentService.handlePaymentSuccess).not.toHaveBeenCalled();
    expect(pharmacySessionService.handleCartPaymentSuccess).not.toHaveBeenCalled();
  });

  test('routes prescription_cart metadata to pharmacySessionService with the cartId', async () => {
    const req = {
      params: { provider: 'paystack' },
      body: { event: 'charge.success', data: { reference: 'cart-ref-1', metadata: { type: 'prescription_cart', cartId: 'cart-123' } } },
    };
    await pharmacyWebhookController.handleWebhook(req, makeRes());

    expect(pharmacySessionService.handleCartPaymentSuccess).toHaveBeenCalledWith('cart-123');
    expect(patientWalletService.handleTopUpSuccess).not.toHaveBeenCalled();
    expect(pharmacyPaymentService.handlePaymentSuccess).not.toHaveBeenCalled();
  });

  test('falls through to the invoice path when metadata has an invoiceId', async () => {
    const req = {
      params: { provider: 'paystack' },
      body: { event: 'charge.success', data: { reference: 'inv-ref-1', metadata: { invoiceId: 'invoice-1' } } },
    };
    await pharmacyWebhookController.handleWebhook(req, makeRes());

    expect(pharmacyPaymentRepo.findByReference).toHaveBeenCalledWith('inv-ref-1');
    expect(pharmacyPaymentService.handlePaymentSuccess).toHaveBeenCalledWith('invoice-1', { id: 'payment-1' });
  });

  test('does nothing when reference is missing', async () => {
    const req = { params: { provider: 'paystack' }, body: { event: 'charge.success', data: { metadata: { invoiceId: 'invoice-1' } } } };
    await pharmacyWebhookController.handleWebhook(req, makeRes());

    expect(pharmacyPaymentRepo.findByReference).not.toHaveBeenCalled();
    expect(pharmacyPaymentService.handlePaymentSuccess).not.toHaveBeenCalled();
  });

  test('does nothing when metadata has neither wallet_topup, prescription_cart, nor invoiceId', async () => {
    const req = { params: { provider: 'paystack' }, body: { event: 'charge.success', data: { reference: 'ref-1', metadata: {} } } };
    await pharmacyWebhookController.handleWebhook(req, makeRes());

    expect(pharmacyPaymentRepo.findByReference).not.toHaveBeenCalled();
    expect(pharmacyPaymentService.handlePaymentSuccess).not.toHaveBeenCalled();
  });

  test('handles missing metadata entirely without throwing', async () => {
    const req = { params: { provider: 'paystack' }, body: { event: 'charge.success', data: { reference: 'ref-1' } } };
    await expect(pharmacyWebhookController.handleWebhook(req, makeRes())).resolves.toBeUndefined();
    expect(pharmacyPaymentService.handlePaymentSuccess).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Paystack — transfer events (payouts)
// ============================================================================

describe('Paystack transfer routing', () => {
  test('transfer.success calls handleTransferSuccess with the transfer_code', async () => {
    const req = { params: { provider: 'paystack' }, body: { event: 'transfer.success', data: { transfer_code: 'TRF_1' } } };
    await pharmacyWebhookController.handleWebhook(req, makeRes());
    expect(pharmacyPaymentService.handleTransferSuccess).toHaveBeenCalledWith('TRF_1');
  });

  test('transfer.failed calls handleTransferFailed with transfer_code and reason', async () => {
    const req = { params: { provider: 'paystack' }, body: { event: 'transfer.failed', data: { transfer_code: 'TRF_1', gateway_response: 'Insufficient funds' } } };
    await pharmacyWebhookController.handleWebhook(req, makeRes());
    expect(pharmacyPaymentService.handleTransferFailed).toHaveBeenCalledWith('TRF_1', 'Insufficient funds');
  });

  test('transfer.reversed also calls handleTransferFailed, defaulting reason to the event name', async () => {
    const req = { params: { provider: 'paystack' }, body: { event: 'transfer.reversed', data: { transfer_code: 'TRF_1' } } };
    await pharmacyWebhookController.handleWebhook(req, makeRes());
    expect(pharmacyPaymentService.handleTransferFailed).toHaveBeenCalledWith('TRF_1', 'transfer.reversed');
  });

  test('ignores transfer events with no transfer_code', async () => {
    const req = { params: { provider: 'paystack' }, body: { event: 'transfer.success', data: {} } };
    await pharmacyWebhookController.handleWebhook(req, makeRes());
    expect(pharmacyPaymentService.handleTransferSuccess).not.toHaveBeenCalled();
  });

  test('an unrecognized event is a no-op', async () => {
    const req = { params: { provider: 'paystack' }, body: { event: 'some.other.event', data: {} } };
    await pharmacyWebhookController.handleWebhook(req, makeRes());
    expect(pharmacyPaymentService.handlePaymentSuccess).not.toHaveBeenCalled();
    expect(pharmacyPaymentService.handleTransferSuccess).not.toHaveBeenCalled();
    expect(pharmacyPaymentService.handleTransferFailed).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Flutterwave — charge.completed routing
// ============================================================================

describe('Flutterwave charge.completed routing', () => {
  test('ignores a charge that is not "successful"', async () => {
    const req = { params: { provider: 'flutterwave' }, body: { event: 'charge.completed', data: { status: 'failed', tx_ref: 'ref-1' } } };
    await pharmacyWebhookController.handleWebhook(req, makeRes());
    expect(pharmacyPaymentService.handlePaymentSuccess).not.toHaveBeenCalled();
  });

  test('routes wallet_topup meta to patientWalletService using tx_ref', async () => {
    const req = {
      params: { provider: 'flutterwave' },
      body: { event: 'charge.completed', data: { status: 'successful', tx_ref: 'wallet-ref-1', meta: { type: 'wallet_topup' } } },
    };
    await pharmacyWebhookController.handleWebhook(req, makeRes());
    expect(patientWalletService.handleTopUpSuccess).toHaveBeenCalledWith('wallet-ref-1');
  });

  test('routes prescription_cart meta to pharmacySessionService', async () => {
    const req = {
      params: { provider: 'flutterwave' },
      body: { event: 'charge.completed', data: { status: 'successful', tx_ref: 'cart-ref-1', meta: { type: 'prescription_cart', cartId: 'cart-9' } } },
    };
    await pharmacyWebhookController.handleWebhook(req, makeRes());
    expect(pharmacySessionService.handleCartPaymentSuccess).toHaveBeenCalledWith('cart-9');
  });

  test('falls through to the invoice path using meta.invoiceId', async () => {
    const req = {
      params: { provider: 'flutterwave' },
      body: { event: 'charge.completed', data: { status: 'successful', tx_ref: 'inv-ref-1', meta: { invoiceId: 'invoice-9' } } },
    };
    await pharmacyWebhookController.handleWebhook(req, makeRes());
    expect(pharmacyPaymentRepo.findByReference).toHaveBeenCalledWith('inv-ref-1');
    expect(pharmacyPaymentService.handlePaymentSuccess).toHaveBeenCalledWith('invoice-9', { id: 'payment-1' });
  });

  test('does nothing when tx_ref is missing on a successful charge', async () => {
    const req = { params: { provider: 'flutterwave' }, body: { event: 'charge.completed', data: { status: 'successful', meta: { invoiceId: 'invoice-9' } } } };
    await pharmacyWebhookController.handleWebhook(req, makeRes());
    expect(pharmacyPaymentRepo.findByReference).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Flutterwave — transfer.completed (payouts use reference, not transfer_code)
// ============================================================================

describe('Flutterwave transfer.completed routing', () => {
  // pharmacyWebhookController requires config/database lazily (inside this
  // one switch case) rather than at module load time, so it must be mocked
  // and the controller re-required fresh in an isolated module registry —
  // the top-of-file jest.mock() calls don't cover a require() that happens
  // at call time deep inside a function body.
  //
  // BUG FOUND & FIXED (src/features/pharmacy/controllers/pharmacyWebhookController.js,
  // was line 134): config/database.js does `module.exports = AppDataSource`
  // (a plain TypeORM DataSource instance, not `{ AppDataSource }`), but this
  // handler did `const { AppDataSource } = require(...)`, destructuring a
  // property that doesn't exist. AppDataSource was therefore always
  // undefined, so `AppDataSource.getRepository(...)` threw on every
  // Flutterwave transfer.completed event — swallowed by handleWebhook's
  // outer try/catch, so Flutterwave payout completions were silently never
  // reconciled. Same bug, same fix, was also found in
  // src/features/pharmacy/jobs/pharmacyClearanceJob.js (the daily escrow
  // clearance job), which had the identical destructuring mistake.
  test('looks up the payout by reference and forwards its transferCode when status is SUCCESSFUL', async () => {
    jest.resetModules();
    const mockFindOne = jest.fn().mockResolvedValue({ transferCode: 'TRF_99' });
    jest.doMock('../../../../config/database', () => ({
      getRepository: jest.fn(() => ({ findOne: mockFindOne })),
    }));
    jest.doMock('../../services/pharmacyPaymentService', () => ({
      handlePaymentSuccess:  jest.fn().mockResolvedValue(undefined),
      handleTransferSuccess: jest.fn().mockResolvedValue(undefined),
      handleTransferFailed:  jest.fn().mockResolvedValue(undefined),
    }));
    jest.doMock('../../repositories/pharmacyPaymentRepository', () => ({
      findByReference: jest.fn().mockResolvedValue(null),
    }));
    jest.doMock('../../services/patientWalletService', () => ({ handleTopUpSuccess: jest.fn().mockResolvedValue(undefined) }));
    jest.doMock('../../services/pharmacySessionService', () => ({ handleCartPaymentSuccess: jest.fn().mockResolvedValue(undefined) }));

    const freshController    = require('../pharmacyWebhookController');
    const freshPaymentService = require('../../services/pharmacyPaymentService');
    const freshDatabase       = require('../../../../config/database');

    const req = { params: { provider: 'flutterwave' }, body: { event: 'transfer.completed', data: { status: 'SUCCESSFUL', reference: 'payout-ref-1' } } };
    await freshController.handleWebhook(req, makeRes());

    expect(freshDatabase.getRepository).toHaveBeenCalledWith('PharmacyPayoutRequest');
    expect(mockFindOne).toHaveBeenCalledWith({ where: { reference: 'payout-ref-1' } });
    expect(freshPaymentService.handleTransferSuccess).toHaveBeenCalledWith('TRF_99');

    jest.dontMock('../../../../config/database');
    jest.dontMock('../../services/pharmacyPaymentService');
    jest.dontMock('../../repositories/pharmacyPaymentRepository');
    jest.dontMock('../../services/patientWalletService');
    jest.dontMock('../../services/pharmacySessionService');
    jest.resetModules();
  });

  test('does not call handleTransferSuccess when status is not SUCCESSFUL', async () => {
    const req = { params: { provider: 'flutterwave' }, body: { event: 'transfer.completed', data: { status: 'FAILED', reference: 'payout-ref-1' } } };
    await pharmacyWebhookController.handleWebhook(req, makeRes());
    expect(pharmacyPaymentService.handleTransferSuccess).not.toHaveBeenCalled();
  });
});
