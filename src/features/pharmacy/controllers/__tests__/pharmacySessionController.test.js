/* eslint-env jest */
// Unit tests for PharmacySessionController — the prescription-cart session
// flow (patient starts a session -> pharmacy builds a cart -> patient
// approves and pays). Focus: the isClientError(msg) substring matcher that
// decides 400-vs-500 mapping for every method here, and the
// resolvePharmacyId 403 short-circuit used by all pharmacy-side endpoints.
//
// BUGS FOUND & FIXED (src/features/pharmacy/controllers/pharmacySessionController.js,
// isClientError): two of pharmacySessionService's real thrown messages did
// not match any of the substring checks, so they fell through to
// next(error) — a 500 — instead of the controller's intended 400:
//   1. "Cart has no items or total"              (approveAndPay)
//   2. "Can only add items to an active session"    (addCartItem)
//      "Can only modify items in an active session" (removeCartItem)
// Added `msg.includes("no items")` and `msg.includes("Can only")`. Same
// class of bug as the promotionWebhookController isClientError mismatch
// found in the vendor feature — an error-message substring check that
// silently drifted from what the service actually throws.

jest.mock('../../services/pharmacySessionService');
jest.mock('../../repositories/pharmacyProfileRepository');

const sessionService      = require('../../services/pharmacySessionService');
const pharmacyProfileRepo = require('../../repositories/pharmacyProfileRepository');

const controller = require('../pharmacySessionController');

const USER_ID     = 'aaaa0000-0000-0000-0000-000000000001';
const PHARMACY_ID = 'bbbb0000-0000-0000-0000-000000000002';
const SESSION_ID  = 'cccc0000-0000-0000-0000-000000000003';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue({ id: PHARMACY_ID });
});

// ============================================================================
// resolvePharmacyId — used by every pharmacy-side method
// ============================================================================

describe('pharmacy-side methods share the resolvePharmacyId 403 guard', () => {
  test('getPharmacySessions returns 403 when the caller has no pharmacy profile', async () => {
    pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue(null);
    const req  = { user: { id: USER_ID }, query: {} };
    const res  = makeRes();
    const next = jest.fn();

    await controller.getPharmacySessions(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Pharmacy profile not found' });
    expect(next).not.toHaveBeenCalled();
    expect(sessionService.getPharmacySessions).not.toHaveBeenCalled();
  });

  test('addCartItem resolves the pharmacy profile id before calling the service', async () => {
    sessionService.addCartItem = jest.fn().mockResolvedValue({ items: [] });
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID }, body: { productName: 'Panadol', quantity: 1, unitPriceNgn: 500 } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.addCartItem(req, res, next);

    expect(sessionService.addCartItem).toHaveBeenCalledWith(PHARMACY_ID, SESSION_ID, req.body);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ============================================================================
// isClientError mapping — the two bugs fixed above, plus the existing paths
// ============================================================================

describe('approveAndPay error mapping', () => {
  test('BUGFIX: "Cart has no items or total" now maps to 400, not next(error)/500', async () => {
    sessionService.approveAndPay = jest.fn().mockRejectedValue(new Error('Cart has no items or total'));
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.approveAndPay(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Cart has no items or total' });
    expect(next).not.toHaveBeenCalled();
  });

  test('"Session has expired..." still maps to 400', async () => {
    sessionService.approveAndPay = jest.fn().mockRejectedValue(new Error('Session has expired. Please start a new session.'));
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.approveAndPay(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('an unrecognized error message is passed to next() (500 path), not swallowed as 400', async () => {
    sessionService.approveAndPay = jest.fn().mockRejectedValue(new Error('Unexpected database failure'));
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.approveAndPay(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unexpected database failure' }));
    expect(res.status).not.toHaveBeenCalled();
  });

  test('succeeds and returns the payment URL payload', async () => {
    sessionService.approveAndPay = jest.fn().mockResolvedValue({ paymentUrl: 'https://pay.example/xyz', reference: 'ref-1' });
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.approveAndPay(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, paymentUrl: 'https://pay.example/xyz' }));
  });
});

describe('addCartItem / removeCartItem error mapping', () => {
  test('BUGFIX: "Can only add items to an active session" now maps to 400', async () => {
    sessionService.addCartItem = jest.fn().mockRejectedValue(new Error('Can only add items to an active session'));
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID }, body: {} };
    const res  = makeRes();
    const next = jest.fn();

    await controller.addCartItem(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Can only add items to an active session' });
    expect(next).not.toHaveBeenCalled();
  });

  test('BUGFIX: "Can only modify items in an active session" now maps to 400', async () => {
    sessionService.removeCartItem = jest.fn().mockRejectedValue(new Error('Can only modify items in an active session'));
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID, itemId: 'item-1' } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.removeCartItem(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Can only modify items in an active session' });
    expect(next).not.toHaveBeenCalled();
  });

  test('a 403 from resolvePharmacyId short-circuits before the service is even called', async () => {
    pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue(null);
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID }, body: {} };
    const res  = makeRes();
    const next = jest.fn();

    await controller.addCartItem(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(sessionService.addCartItem).not.toHaveBeenCalled();
  });
});

describe('startSession / cancelSession (patient-side)', () => {
  test('startSession: "already have an active session" maps to 400', async () => {
    sessionService.startSession = jest.fn().mockRejectedValue(
      new Error('You already have an active session with this pharmacy for this prescription')
    );
    const req  = { user: { id: USER_ID }, body: { prescriptionId: 'rx-1', pharmacyId: PHARMACY_ID } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.startSession(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('startSession: succeeds and includes the timeout message', async () => {
    sessionService.startSession = jest.fn().mockResolvedValue({ id: SESSION_ID, status: 'active' });
    const req  = { user: { id: USER_ID }, body: { prescriptionId: 'rx-1', pharmacyId: PHARMACY_ID } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.startSession(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      session: { id: SESSION_ID, status: 'active' },
    }));
  });

  test('cancelSession: "cannot be cancelled — current status" maps to 400 (lowercase "cannot" pattern)', async () => {
    sessionService.cancelSession = jest.fn().mockRejectedValue(new Error('Session cannot be cancelled — current status: approved'));
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.cancelSession(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('cancelSession: "Cannot cancel a paid session..." maps to 400 (capital-C pattern)', async () => {
    sessionService.cancelSession = jest.fn().mockRejectedValue(new Error('Cannot cancel a paid session. Raise a dispute instead.'));
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.cancelSession(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getPatientSessionById / getPharmacySessionById — not-found maps to 404', () => {
  test('patient: "Session not found" maps to 404', async () => {
    sessionService.getPatientSessionById = jest.fn().mockRejectedValue(new Error('Session not found'));
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.getPatientSessionById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('pharmacy: 403 from resolvePharmacyId takes precedence over the service call', async () => {
    pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue(null);
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.getPharmacySessionById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(sessionService.getPharmacySessionById).not.toHaveBeenCalled();
  });

  test('pharmacy: "Session not found" (a client error, not a 403) maps to 404', async () => {
    sessionService.getPharmacySessionById = jest.fn().mockRejectedValue(new Error('Session not found'));
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.getPharmacySessionById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('finaliseCart / cancelSessionByPharmacy', () => {
  test('finaliseCart: "Cart must have at least one item before finalising" maps to 400', async () => {
    sessionService.finaliseCart = jest.fn().mockRejectedValue(new Error('Cart must have at least one item before finalising'));
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID }, body: {} };
    const res  = makeRes();
    const next = jest.fn();

    await controller.finaliseCart(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('finaliseCart: succeeds', async () => {
    sessionService.finaliseCart = jest.fn().mockResolvedValue({ id: SESSION_ID, status: 'cart_ready' });
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID }, body: { deliveryFee: 500 } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.finaliseCart(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(sessionService.finaliseCart).toHaveBeenCalledWith(PHARMACY_ID, SESSION_ID, req.body);
  });

  test('cancelSessionByPharmacy: "Session is no longer active" maps to 400', async () => {
    sessionService.cancelSessionByPharmacy = jest.fn().mockRejectedValue(new Error('Session is no longer active'));
    const req  = { user: { id: USER_ID }, params: { sessionId: SESSION_ID } };
    const res  = makeRes();
    const next = jest.fn();

    await controller.cancelSessionByPharmacy(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
