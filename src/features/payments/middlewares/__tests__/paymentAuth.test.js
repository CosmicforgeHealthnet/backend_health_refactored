/* eslint-env jest */
// Unit tests for PaymentAuthMiddleware — the gate on every wallet/dispute
// endpoint (src/features/payments/routes/wallet.js, dispute.js).
//
// Context: the doctor-verification status-consistency bug fixed on
// 2026-08-25 (users.status drifting from the real verification_requests
// outcome) had a second-order symptom — a doctor whose DB status was just
// corrected (e.g. by an admin approval, or by the reconciliation script)
// could still be denied wallet access, because requireVerifiedDoctor read
// the verification status from the JWT payload (baked in at login/refresh,
// valid up to ACCESS_EXPIRES = 15m) instead of a fresh DB read.
//
// Fix (2026-08-25): verifyPaymentAuth now does a fresh DB lookup and
// populates req.fullUser, and is wired into wallet.js/dispute.js right after
// authenticateJWT. requireVerifiedDoctor already preferred req.fullUser over
// req.user when present — it just never had it populated before.

jest.mock('../../../auth/repositories/userRepository');

// paymentAuth.js's dependency chain used to pull in authMiddleware.js, which
// throws at require-time if JWT_SECRET isn't set. No longer required after
// the fix (verifyPaymentAuth no longer re-runs authenticateJWT itself), but
// harmless to keep in case that changes again.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const userRepository = require('../../../auth/repositories/userRepository');
const PaymentAuthMiddleware = require('../paymentAuth');

const DOCTOR_ID = 'bbbb0000-0000-0000-0000-000000000002';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// SUITE 1 - requireVerifiedDoctor in isolation
// ============================================================================

describe('requireVerifiedDoctor', () => {
  test('allows a doctor whose status says doctor_active', () => {
    const req = { user: { sub: DOCTOR_ID, role: 'doctor', status: 'doctor_active' } };
    const res = makeRes();
    const next = jest.fn();

    PaymentAuthMiddleware.requireVerifiedDoctor(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('blocks a non-doctor role regardless of status', () => {
    const req = { user: { sub: DOCTOR_ID, role: 'patient', status: 'doctor_active' } };
    const res = makeRes();
    const next = jest.fn();

    PaymentAuthMiddleware.requireVerifiedDoctor(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Only doctors can access wallet features' });
  });

  test('blocks a doctor who is genuinely still pending verification', () => {
    const req = { user: { sub: DOCTOR_ID, role: 'doctor', status: 'pending_doctor_verification' } };
    const res = makeRes();
    const next = jest.fn();

    PaymentAuthMiddleware.requireVerifiedDoctor(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Doctor account must be verified to access wallet',
      currentStatus: 'pending_doctor_verification',
    });
  });

  test('prefers req.fullUser (fresh DB read) over the stale req.user (JWT) status when both are present', () => {
    // This is the mechanism the fix relies on: verifyPaymentAuth populates
    // req.fullUser before requireVerifiedDoctor runs, so a doctor who was
    // just approved is let in immediately, even on an old access token that
    // still carries the pre-approval status.
    const req = {
      user: { sub: DOCTOR_ID, role: 'doctor', status: 'pending_doctor_verification' }, // stale JWT
      fullUser: { id: DOCTOR_ID, role: 'doctor', status: 'doctor_active' }, // fresh DB read
    };
    const res = makeRes();
    const next = jest.fn();

    PaymentAuthMiddleware.requireVerifiedDoctor(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('without req.fullUser, falls back to the (possibly stale) JWT status', () => {
    // Documents the pre-fix behavior this middleware has always had in
    // isolation — still correct for routes that legitimately never call
    // verifyPaymentAuth, but exactly what caused the bug when nothing ever
    // populated req.fullUser in the real request chain.
    const req = { user: { sub: DOCTOR_ID, role: 'doctor', status: 'doctor_active' } };
    const res = makeRes();
    const next = jest.fn();

    PaymentAuthMiddleware.requireVerifiedDoctor(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// SUITE 2 - verifyPaymentAuth: the fresh-DB-read step, now wired into the
// wallet.js / dispute.js middleware chains ahead of requireVerifiedDoctor
// ============================================================================

describe('verifyPaymentAuth', () => {
  test('attaches a fresh DB read of the user as req.fullUser and calls next', async () => {
    const freshUser = { id: DOCTOR_ID, role: 'doctor', status: 'doctor_active' };
    userRepository.findById = jest.fn().mockResolvedValue(freshUser);

    const req = { user: { sub: DOCTOR_ID } };
    const res = makeRes();
    const next = jest.fn();

    await PaymentAuthMiddleware.verifyPaymentAuth(req, res, next);

    expect(userRepository.findById).toHaveBeenCalledWith(DOCTOR_ID);
    expect(req.fullUser).toBe(freshUser);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 401 when the user no longer exists', async () => {
    userRepository.findById = jest.fn().mockResolvedValue(null);

    const req = { user: { sub: DOCTOR_ID } };
    const res = makeRes();
    const next = jest.fn();

    await PaymentAuthMiddleware.verifyPaymentAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });

  test('returns 403 when the fresh DB status is locked, even if the JWT never carries "locked"', async () => {
    // Login bakes status: user.status === 'locked' ? 'active' : user.status
    // into the JWT, so a token can never itself say "locked" — this fresh
    // read is the only place a lock taking effect mid-session is caught.
    userRepository.findById = jest.fn().mockResolvedValue({ id: DOCTOR_ID, status: 'locked' });

    const req = { user: { sub: DOCTOR_ID, status: 'active' } };
    const res = makeRes();
    const next = jest.fn();

    await PaymentAuthMiddleware.verifyPaymentAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Account is locked. Contact support.' });
  });

  test('returns 500 when the user lookup itself fails', async () => {
    userRepository.findById = jest.fn().mockRejectedValue(new Error('connection reset'));

    const req = { user: { sub: DOCTOR_ID } };
    const res = makeRes();
    const next = jest.fn();

    await PaymentAuthMiddleware.verifyPaymentAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ============================================================================
// SUITE 3 - End-to-end: the actual chain now used in wallet.js / dispute.js
// (verifyPaymentAuth -> requireVerifiedDoctor), proving the original bug is
// closed.
// ============================================================================

describe('verifyPaymentAuth + requireVerifiedDoctor chained (the real route order)', () => {
  test('a doctor just approved in the DB is let in immediately, on their old pre-approval token', async () => {
    // The exact regression scenario: token minted while pending, DB updated
    // to doctor_active afterwards (by approveVerification or the
    // reconciliation script), no new login/refresh has happened yet.
    userRepository.findById = jest.fn().mockResolvedValue({ id: DOCTOR_ID, role: 'doctor', status: 'doctor_active' });

    const req = { user: { sub: DOCTOR_ID, role: 'doctor', status: 'pending_doctor_verification' } };
    const res = makeRes();
    const next = jest.fn();

    await PaymentAuthMiddleware.verifyPaymentAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    next.mockClear();
    PaymentAuthMiddleware.requireVerifiedDoctor(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('a doctor who was rejected after their token was issued is now correctly blocked', async () => {
    userRepository.findById = jest.fn().mockResolvedValue({ id: DOCTOR_ID, role: 'doctor', status: 'pending_doctor_verification' });

    const req = { user: { sub: DOCTOR_ID, role: 'doctor', status: 'doctor_active' } }; // stale, pre-rejection token
    const res = makeRes();
    const next = jest.fn();

    await PaymentAuthMiddleware.verifyPaymentAuth(req, res, next);
    next.mockClear();

    PaymentAuthMiddleware.requireVerifiedDoctor(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
