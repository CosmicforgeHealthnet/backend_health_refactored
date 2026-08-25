/* eslint-env jest */
// Unit tests for VendorAuthController — this controller carries real inline
// business logic (buildVendorAccountState's stage/pendingActions machine,
// the MFA short-circuit on login, and verifyEmail's token/expiry handling),
// not just thin delegation, so it gets full coverage rather than a light
// validation-only pass.

jest.mock('../../services/vendorAuthService');
jest.mock('../../../auth/services/authService');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('../../../auth/services/passwordResetService');
jest.mock('../../../auth/services/verificationService');
jest.mock('../../../auth/services/refreshTokenService');
jest.mock('../../../auth/repositories/emailVerificationRepository');
jest.mock('../../../auth/services/mfa/mfaService');
jest.mock('bcryptjs');
jest.mock('../../../../config/database');

const vendorAuthService = require('../../services/vendorAuthService');
const authService = require('../../../auth/services/authService');
const userRepository = require('../../../auth/repositories/userRepository');
const passwordResetService = require('../../../auth/services/passwordResetService');
const verificationService = require('../../../auth/services/verificationService');
const refreshTokenService = require('../../../auth/services/refreshTokenService');
const emailVerRepo = require('../../../auth/repositories/emailVerificationRepository');
const mfaService = require('../../../auth/services/mfa/mfaService');
const bcrypt = require('bcryptjs');
const AppDataSource = require('../../../../config/database');

const vendorAuthController = require('../vendorAuthController');

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VENDOR_ID = 'bbbb0000-0000-0000-0000-000000000002';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeNext() { return jest.fn(); }

function makeUser(overrides = {}) {
  return {
    id: USER_ID, fullName: 'V Endor', email: 'vendor@example.com', role: 'vendor',
    status: 'vendor_active', tier: 'free', passwordHash: 'hashed', mfaEnabled: false,
    ...overrides,
  };
}

function makeVendor(overrides = {}) {
  return {
    id: VENDOR_ID, businessName: 'Vee Shop', businessCategory: 'health_wellness',
    verificationStatus: 'approved', isActive: true, documentsSubmitted: true,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  vendorAuthService.registerVendor = jest.fn().mockResolvedValue({
    user: makeUser({ status: 'pending_email_verification' }),
    vendor: makeVendor({ verificationStatus: 'pending', isActive: false, documentsSubmitted: false }),
    emailSent: true,
  });
  vendorAuthService.getVendorProfile = jest.fn().mockResolvedValue({ vendor: makeVendor(), user: makeUser() });
  vendorAuthService.updateVendorProfile = jest.fn().mockResolvedValue(makeVendor());
  vendorAuthService.uploadVendorLogo = jest.fn().mockResolvedValue({ logoUrl: 'http://x/logo.png' });
  vendorAuthService.uploadDocuments = jest.fn().mockResolvedValue([{ id: 'doc-1', documentType: 'government_id', documentUrl: 'http://x/id.png' }]);
  vendorAuthService.getAllVendors = jest.fn().mockResolvedValue({ vendors: [], total: 0, page: 1, limit: 20 });

  authService.login = jest.fn().mockResolvedValue({ accessToken: 'access-tok', refreshToken: 'refresh-tok' });

  userRepository.findByEmailAndRole = jest.fn().mockResolvedValue(makeUser());
  userRepository.findById = jest.fn().mockResolvedValue(makeUser());

  passwordResetService.requestReset = jest.fn().mockResolvedValue(undefined);
  passwordResetService.resetPassword = jest.fn().mockResolvedValue(undefined);

  verificationService.resendVerificationEmail = jest.fn().mockResolvedValue(undefined);

  refreshTokenService.rotateRefreshToken = jest.fn().mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' });

  emailVerRepo.findByToken = jest.fn().mockResolvedValue({ user: { id: USER_ID }, usedAt: null, expiresAt: new Date(Date.now() + 100000) });

  mfaService.generateTempToken = jest.fn().mockResolvedValue('temp-mfa-token');

  bcrypt.compare = jest.fn().mockResolvedValue(true);
  bcrypt.hash = jest.fn().mockResolvedValue('new-hashed');

  AppDataSource.getRepository = jest.fn().mockReturnValue({ update: jest.fn().mockResolvedValue(undefined) });
});

// ============================================================================
// SUITE 1 - registerVendor: validation + category whitelist
// ============================================================================

describe('registerVendor', () => {
  const VALID_BODY = {
    fullName: 'V', email: 'v@x.com', password: 'pw', businessName: 'B',
    businessCategory: 'health_wellness', businessEmail: 'b@x.com', businessPhone: '1',
    country: 'NG', state: 'Lagos', city: 'Lagos', fullAddress: '1 St', businessDescription: 'd',
  };

  test('400s when a required field is missing', async () => {
    const req = { body: { ...VALID_BODY, fullName: undefined }, location: {} };
    const res = makeRes();
    await vendorAuthController.registerVendor(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(vendorAuthService.registerVendor).not.toHaveBeenCalled();
  });

  test('400s on an invalid businessCategory', async () => {
    const req = { body: { ...VALID_BODY, businessCategory: 'not_real' }, location: {} };
    const res = makeRes();
    await vendorAuthController.registerVendor(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test('201s and reports emailSent=true in the message on success', async () => {
    const req = { body: VALID_BODY, location: { countryCode: 'NG' } };
    const res = makeRes();
    await vendorAuthController.registerVendor(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: expect.stringContaining('Check your email'),
    }));
  });

  test('reports the fallback message when emailSent=false', async () => {
    vendorAuthService.registerVendor = jest.fn().mockResolvedValue({
      user: makeUser(), vendor: makeVendor(), emailSent: false,
    });
    const req = { body: VALID_BODY, location: {} };
    const res = makeRes();
    await vendorAuthController.registerVendor(req, res, makeNext());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("couldn't send a verification email"),
    }));
  });

  test('maps an "already in use" service error to 400 instead of passing to next()', async () => {
    vendorAuthService.registerVendor = jest.fn().mockRejectedValue(new Error('Email already in use'));
    const req = { body: VALID_BODY, location: {} };
    const res = makeRes();
    const next = makeNext();
    await vendorAuthController.registerVendor(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('forwards an unrelated error to next()', async () => {
    vendorAuthService.registerVendor = jest.fn().mockRejectedValue(new Error('DB exploded'));
    const req = { body: VALID_BODY, location: {} };
    const res = makeRes();
    const next = makeNext();
    await vendorAuthController.registerVendor(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ============================================================================
// SUITE 2 - loginVendor: credential checks + MFA short-circuit + accountState
// ============================================================================

describe('loginVendor', () => {
  test('400s when email or password missing', async () => {
    const req = { body: { email: 'x@x.com' } };
    const res = makeRes();
    await vendorAuthController.loginVendor(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('401s when no vendor user matches the email', async () => {
    userRepository.findByEmailAndRole = jest.fn().mockResolvedValue(null);
    const req = { body: { email: 'x@x.com', password: 'pw' }, headers: {} };
    const res = makeRes();
    await vendorAuthController.loginVendor(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid credentials' });
  });

  test('401s on a wrong password', async () => {
    bcrypt.compare = jest.fn().mockResolvedValue(false);
    const req = { body: { email: 'x@x.com', password: 'wrong' }, headers: {} };
    const res = makeRes();
    await vendorAuthController.loginVendor(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('short-circuits with 206 + tempToken when MFA is enabled, without calling authService.login', async () => {
    userRepository.findByEmailAndRole = jest.fn().mockResolvedValue(makeUser({ mfaEnabled: true }));
    const req = { body: { email: 'x@x.com', password: 'pw' }, headers: {} };
    const res = makeRes();
    await vendorAuthController.loginVendor(req, res, makeNext());

    expect(res.status).toHaveBeenCalledWith(206);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mfaRequired: true, tempToken: 'temp-mfa-token' }));
    expect(authService.login).not.toHaveBeenCalled();
  });

  test('logs in successfully and includes a computed accountState for an approved+active vendor', async () => {
    const req = { body: { email: 'x@x.com', password: 'pw' }, headers: {} };
    const res = makeRes();
    await vendorAuthController.loginVendor(req, res, makeNext());

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.vendor.accountState).toEqual(expect.objectContaining({
      stage: 'approved', isApproved: true, canListProducts: true, canReceiveOrders: true,
    }));
  });

  test('accountState reflects "documents_required" for a pending vendor with a verified email', async () => {
    userRepository.findByEmailAndRole = jest.fn().mockResolvedValue(makeUser({ status: 'vendor_active' }));
    vendorAuthService.getVendorProfile = jest.fn().mockResolvedValue({
      vendor: makeVendor({ verificationStatus: 'pending' }), user: makeUser({ status: 'vendor_active' }),
    });
    const req = { body: { email: 'x@x.com', password: 'pw' }, headers: {} };
    const res = makeRes();
    await vendorAuthController.loginVendor(req, res, makeNext());

    const payload = res.json.mock.calls[0][0];
    expect(payload.vendor.accountState).toEqual(expect.objectContaining({
      stage: 'documents_required', isApproved: false, pendingActions: ['upload_documents'],
    }));
  });

  test('accountState reflects "email_unverified" before anything else, even if somehow already approved', async () => {
    userRepository.findByEmailAndRole = jest.fn().mockResolvedValue(makeUser({ status: 'pending_email_verification' }));
    vendorAuthService.getVendorProfile = jest.fn().mockResolvedValue({
      vendor: makeVendor({ verificationStatus: 'approved' }), user: makeUser({ status: 'pending_email_verification' }),
    });
    const req = { body: { email: 'x@x.com', password: 'pw' }, headers: {} };
    const res = makeRes();
    await vendorAuthController.loginVendor(req, res, makeNext());

    const payload = res.json.mock.calls[0][0];
    expect(payload.vendor.accountState.stage).toBe('email_unverified');
    // isApproved requires BOTH verificationStatus==='approved' AND user.status==='vendor_active' —
    // an unverified email must never present as approved even if verificationStatus already flipped.
    expect(payload.vendor.accountState.isApproved).toBe(false);
  });

  test('accountState reflects "rejected" with a re-upload prompt', async () => {
    vendorAuthService.getVendorProfile = jest.fn().mockResolvedValue({
      vendor: makeVendor({ verificationStatus: 'rejected' }), user: makeUser(),
    });
    const req = { body: { email: 'x@x.com', password: 'pw' }, headers: {} };
    const res = makeRes();
    await vendorAuthController.loginVendor(req, res, makeNext());

    const payload = res.json.mock.calls[0][0];
    expect(payload.vendor.accountState).toEqual(expect.objectContaining({
      stage: 'rejected', pendingActions: ['upload_documents'],
    }));
  });
});

// ============================================================================
// SUITE 3 - verifyEmail
// ============================================================================

describe('verifyEmail', () => {
  test('400s when token is missing', async () => {
    const req = { query: {} };
    const res = makeRes();
    await vendorAuthController.verifyEmail(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400s on an unknown token', async () => {
    emailVerRepo.findByToken = jest.fn().mockResolvedValue(null);
    const req = { query: { token: 'bad' } };
    const res = makeRes();
    await vendorAuthController.verifyEmail(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid verification token' });
  });

  test('400s when the resolved user is not a vendor (cross-role token reuse)', async () => {
    userRepository.findById = jest.fn().mockResolvedValue(makeUser({ role: 'patient' }));
    const req = { query: { token: 'tok' } };
    const res = makeRes();
    await vendorAuthController.verifyEmail(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400s when the token has expired', async () => {
    emailVerRepo.findByToken = jest.fn().mockResolvedValue({ user: { id: USER_ID }, usedAt: null, expiresAt: new Date(Date.now() - 1000) });
    userRepository.findById = jest.fn().mockResolvedValue(makeUser({ status: 'pending_email_verification' }));
    const req = { query: { token: 'tok' } };
    const res = makeRes();
    await vendorAuthController.verifyEmail(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Verification token has expired. Request a new one.' });
  });

  test('marks the token used and confirms verification is under review', async () => {
    const ev = { user: { id: USER_ID }, usedAt: null, expiresAt: new Date(Date.now() + 100000) };
    emailVerRepo.findByToken = jest.fn().mockResolvedValue(ev);
    emailVerRepo.save = jest.fn().mockResolvedValue(undefined);
    userRepository.findById = jest.fn().mockResolvedValue(makeUser({ status: 'pending_email_verification' }));

    const req = { query: { token: 'tok' } };
    const res = makeRes();
    await vendorAuthController.verifyEmail(req, res, makeNext());

    expect(ev.usedAt).toBeInstanceOf(Date);
    expect(emailVerRepo.save).toHaveBeenCalledWith(ev);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true, message: expect.stringContaining('under review'),
    }));
  });
});

// ============================================================================
// SUITE 4 - getVendorProfile / updateVendorProfile / uploads (thin delegation)
// ============================================================================

describe('getVendorProfile', () => {
  test('returns vendor + user + accountState for the authenticated vendor', async () => {
    const req = { user: { id: USER_ID } };
    const res = makeRes();
    await vendorAuthController.getVendorProfile(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.vendor.accountState).toBeDefined();
  });

  test('forwards a service error to next()', async () => {
    vendorAuthService.getVendorProfile = jest.fn().mockRejectedValue(new Error('Vendor profile not found'));
    const req = { user: { id: USER_ID } };
    const res = makeRes();
    const next = makeNext();
    await vendorAuthController.getVendorProfile(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('uploadDocument', () => {
  test('400s when no file was uploaded', async () => {
    const req = { savedFiles: [], body: { documentType: 'government_id' } };
    const res = makeRes();
    await vendorAuthController.uploadDocument(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400s on an invalid documentType', async () => {
    const req = { savedFiles: [{ id: 'f1' }], body: { documentType: 'passport' } };
    const res = makeRes();
    await vendorAuthController.uploadDocument(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('uploads successfully with a valid documentType', async () => {
    const req = { savedFiles: [{ id: 'f1', originalFileName: 'id.png', mimeType: 'image/png' }], body: { documentType: 'government_id' }, user: { id: USER_ID } };
    const res = makeRes();
    await vendorAuthController.uploadDocument(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('updateAccountSettings', () => {
  test('400s when the new email is already used by a different vendor account', async () => {
    userRepository.findByEmailAndRole = jest.fn().mockResolvedValue({ id: 'someone-else' });
    const req = { body: { email: 'taken@x.com' }, user: { id: USER_ID } };
    const res = makeRes();
    await vendorAuthController.updateAccountSettings(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('allows keeping your own current email unchanged', async () => {
    userRepository.findByEmailAndRole = jest.fn().mockResolvedValue({ id: USER_ID });
    const req = { body: { email: 'me@x.com' }, user: { id: USER_ID } };
    const res = makeRes();
    await vendorAuthController.updateAccountSettings(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('refresh', () => {
  test('400s when refreshToken or deviceFingerprint is missing', async () => {
    const req = { body: {} };
    const res = makeRes();
    await vendorAuthController.refresh(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rewrites the generic expiry error into a friendlier message', async () => {
    refreshTokenService.rotateRefreshToken = jest.fn().mockRejectedValue(new Error('Invalid or expired refresh token'));
    const req = { body: { refreshToken: 'rt', deviceFingerprint: 'fp' }, headers: {} };
    const res = makeRes();
    await vendorAuthController.refresh(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Your session has expired. Please sign in again.' });
  });
});
