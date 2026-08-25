/* eslint-env jest */
// Unit tests for PharmacyAuthController — this controller carries real
// inline business logic (buildAccountState's stage/pendingActions machine,
// the MFA short-circuit on login, bcrypt password checks, and
// verifyEmail/resendVerification/resetPassword token handling), not just
// thin delegation, so it gets full coverage rather than a light pass. Follows
// the same shape as vendorAuthController.test.js (its sibling in the vendor
// feature) since the two controllers are structurally near-identical.

jest.mock('../../services/pharmacyRegistrationService');
jest.mock('../../repositories/pharmacyProfileRepository');
jest.mock('../../../auth/services/authService');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('../../../auth/services/mfa/mfaService');
jest.mock('../../../auth/services/passwordResetService');
jest.mock('../../../auth/services/verificationService');
jest.mock('../../../auth/repositories/emailVerificationRepository');
jest.mock('bcryptjs');
jest.mock('../../../../config/database');

const pharmacyRegistrationService = require('../../services/pharmacyRegistrationService');
const pharmacyProfileRepo         = require('../../repositories/pharmacyProfileRepository');
const authService                 = require('../../../auth/services/authService');
const userRepo                    = require('../../../auth/repositories/userRepository');
const mfaService                  = require('../../../auth/services/mfa/mfaService');
const passwordResetService        = require('../../../auth/services/passwordResetService');
const verificationService         = require('../../../auth/services/verificationService');
const emailVerRepo                = require('../../../auth/repositories/emailVerificationRepository');
const bcrypt                      = require('bcryptjs');
const AppDataSource                = require('../../../../config/database');

const pharmacyAuthController = require('../pharmacyAuthController');

const USER_ID     = 'aaaa0000-0000-0000-0000-000000000001';
const PHARMACY_ID = 'bbbb0000-0000-0000-0000-000000000002';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}
function makeNext() { return jest.fn(); }

function makeUser(overrides = {}) {
  return {
    id: USER_ID, fullName: 'Pharm Acist', email: 'pharmacy@example.com', role: 'pharmacy',
    status: 'pharmacy_active', provider: 'local', tier: 'free', passwordHash: 'hashed',
    mfaEnabled: false, isOnline: false,
    ...overrides,
  };
}

function makePharmacy(overrides = {}) {
  return {
    id: PHARMACY_ID, pharmacyName: 'Acme Pharmacy', registrationNumber: 'REG-1',
    address: '1 Main St', phone: '0800', primaryContactPerson: 'P Contact',
    email: 'acme@example.com', preferredUsername: 'acmepharm',
    verificationStatus: 'approved', isActive: true, documentsSubmitted: true,
    userId: USER_ID, documents: [], branches: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  pharmacyRegistrationService.registerPharmacy = jest.fn().mockResolvedValue({
    user: makeUser({ status: 'pending_email_verification' }),
    pharmacy: makePharmacy({ verificationStatus: 'pending', isActive: false, documentsSubmitted: false }),
    emailSent: true,
  });
  pharmacyRegistrationService.getPharmacyProfile = jest.fn().mockResolvedValue(makePharmacy());
  pharmacyRegistrationService.updatePharmacyProfile = jest.fn().mockResolvedValue(makePharmacy());
  pharmacyRegistrationService.setPricing = jest.fn().mockResolvedValue({ id: 'price-1' });
  pharmacyRegistrationService.getPricing = jest.fn().mockResolvedValue([{ id: 'price-1' }]);
  pharmacyRegistrationService.deletePricing = jest.fn().mockResolvedValue(undefined);
  pharmacyRegistrationService.addStaffMember = jest.fn().mockResolvedValue({ id: 'staff-1' });
  pharmacyRegistrationService.getStaffMembers = jest.fn().mockResolvedValue([{ id: 'staff-1' }]);
  pharmacyRegistrationService.removeStaffMember = jest.fn().mockResolvedValue({ success: true });
  pharmacyRegistrationService.getAllPharmacies = jest.fn().mockResolvedValue([]);

  pharmacyProfileRepo.findById = jest.fn().mockResolvedValue(makePharmacy());

  authService.login = jest.fn().mockResolvedValue({
    payload: { sub: USER_ID }, accessToken: 'access-tok', refreshToken: 'refresh-tok',
  });

  userRepo.findByEmailAndRole = jest.fn().mockResolvedValue(makeUser());
  userRepo.findById            = jest.fn().mockResolvedValue(makeUser());
  userRepo.update               = jest.fn().mockResolvedValue(undefined);

  mfaService.verifyToken = jest.fn().mockReturnValue(true);

  passwordResetService.requestReset  = jest.fn().mockResolvedValue(undefined);
  passwordResetService.resetPassword = jest.fn().mockResolvedValue(undefined);

  verificationService.resendVerificationEmail = jest.fn().mockResolvedValue(undefined);

  emailVerRepo.findByToken = jest.fn().mockResolvedValue({ usedAt: null, expiresAt: new Date(Date.now() + 100000) });
  emailVerRepo.save        = jest.fn().mockResolvedValue(undefined);

  bcrypt.compare = jest.fn().mockResolvedValue(true);
  bcrypt.hash    = jest.fn().mockResolvedValue('new-hashed');

  AppDataSource.getRepository = jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) });
});

// ============================================================================
// registerPharmacy
// ============================================================================

describe('registerPharmacy', () => {
  const VALID_BODY = {
    fullName: 'P Harmacist', email: 'p@x.com', password: 'pw', pharmacyName: 'Acme',
    registrationNumber: 'REG-1', address: '1 St', phone: '080', primaryContactPerson: 'C',
    preferredUsername: 'acme',
  };

  test('400s when a required field is missing', async () => {
    const req = { body: { ...VALID_BODY, phone: undefined }, location: {} };
    const res = makeRes();
    await pharmacyAuthController.registerPharmacy(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pharmacyRegistrationService.registerPharmacy).not.toHaveBeenCalled();
  });

  test('201s and reports emailSent=true in the message on success', async () => {
    const req = { body: VALID_BODY, location: { countryCode: 'NG' } };
    const res = makeRes();
    await pharmacyAuthController.registerPharmacy(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Check your email'),
    }));
  });

  test('reports the fallback message when emailSent=false', async () => {
    pharmacyRegistrationService.registerPharmacy = jest.fn().mockResolvedValue({
      user: makeUser(), pharmacy: makePharmacy(), emailSent: false,
    });
    const req = { body: VALID_BODY, location: {} };
    const res = makeRes();
    await pharmacyAuthController.registerPharmacy(req, res, makeNext());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("couldn't send a verification email"),
    }));
  });

  test('maps an "already" service error to 400 instead of next()', async () => {
    pharmacyRegistrationService.registerPharmacy = jest.fn().mockRejectedValue(new Error('Email already registered'));
    const req = { body: VALID_BODY, location: {} };
    const res = makeRes();
    const next = makeNext();
    await pharmacyAuthController.registerPharmacy(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('forwards an unrelated error to next()', async () => {
    pharmacyRegistrationService.registerPharmacy = jest.fn().mockRejectedValue(new Error('DB exploded'));
    const req = { body: VALID_BODY, location: {} };
    const res = makeRes();
    const next = makeNext();
    await pharmacyAuthController.registerPharmacy(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ============================================================================
// loginPharmacy — credential checks + MFA short-circuit + accountState
// ============================================================================

describe('loginPharmacy', () => {
  test('400s when email, password, or deviceFingerprint is missing', async () => {
    const req = { body: { email: 'x@x.com', password: 'pw' }, headers: {} };
    const res = makeRes();
    await pharmacyAuthController.loginPharmacy(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(userRepo.findByEmailAndRole).not.toHaveBeenCalled();
  });

  test('401s when no pharmacy user matches the email', async () => {
    userRepo.findByEmailAndRole = jest.fn().mockResolvedValue(null);
    const req = { body: { email: 'x@x.com', password: 'pw', deviceFingerprint: 'fp' }, headers: {} };
    const res = makeRes();
    await pharmacyAuthController.loginPharmacy(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'The email address you entered is not registered.' });
  });

  test('401s when the account has no local password (SSO-only)', async () => {
    userRepo.findByEmailAndRole = jest.fn().mockResolvedValue(makeUser({ passwordHash: null }));
    const req = { body: { email: 'x@x.com', password: 'pw', deviceFingerprint: 'fp' }, headers: {} };
    const res = makeRes();
    await pharmacyAuthController.loginPharmacy(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test('401s on a wrong password', async () => {
    bcrypt.compare = jest.fn().mockResolvedValue(false);
    const req = { body: { email: 'x@x.com', password: 'wrong', deviceFingerprint: 'fp' }, headers: {} };
    const res = makeRes();
    await pharmacyAuthController.loginPharmacy(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'The password you entered is incorrect.' });
    expect(authService.login).not.toHaveBeenCalled();
  });

  test('short-circuits with 206 + tempUserId when MFA is enabled and no mfaToken was sent', async () => {
    userRepo.findByEmailAndRole = jest.fn().mockResolvedValue(makeUser({ mfaEnabled: true }));
    const req = { body: { email: 'x@x.com', password: 'pw', deviceFingerprint: 'fp' }, headers: {} };
    const res = makeRes();
    await pharmacyAuthController.loginPharmacy(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(206);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ requiresMFA: true, tempUserId: USER_ID }));
    expect(authService.login).not.toHaveBeenCalled();
  });

  test('401s when mfaToken is provided but invalid', async () => {
    userRepo.findByEmailAndRole = jest.fn().mockResolvedValue(makeUser({ mfaEnabled: true, mfaSecret: 'secret' }));
    mfaService.verifyToken = jest.fn().mockReturnValue(false);
    const req = { body: { email: 'x@x.com', password: 'pw', deviceFingerprint: 'fp', mfaToken: '000000' }, headers: {} };
    const res = makeRes();
    await pharmacyAuthController.loginPharmacy(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid two-factor authentication code' });
    expect(authService.login).not.toHaveBeenCalled();
  });

  test('logs in successfully with a valid mfaToken', async () => {
    userRepo.findByEmailAndRole = jest.fn().mockResolvedValue(makeUser({ mfaEnabled: true, mfaSecret: 'secret' }));
    mfaService.verifyToken = jest.fn().mockReturnValue(true);
    const req = { body: { email: 'x@x.com', password: 'pw', deviceFingerprint: 'fp', mfaToken: '123456' }, headers: {} };
    const res = makeRes();
    await pharmacyAuthController.loginPharmacy(req, res, makeNext());
    expect(res.status).not.toHaveBeenCalledWith(401);
    expect(authService.login).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-tok' }));
  });

  test('logs in and includes a computed accountState for an approved pharmacy', async () => {
    const req = { body: { email: 'x@x.com', password: 'pw', deviceFingerprint: 'fp' }, headers: {} };
    const res = makeRes();
    await pharmacyAuthController.loginPharmacy(req, res, makeNext());
    const payload = res.json.mock.calls[0][0];
    expect(payload.pharmacy.accountState).toEqual(expect.objectContaining({
      stage: 'approved', isApproved: true, canAccessShop: true, canReceiveOrders: true, nextStep: null,
    }));
  });

  test('accountState reflects vendorModeEnabled when a hybrid VendorProfile exists', async () => {
    AppDataSource.getRepository = jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue({ id: 'vendor-1' }) });
    const req = { body: { email: 'x@x.com', password: 'pw', deviceFingerprint: 'fp' }, headers: {} };
    const res = makeRes();
    await pharmacyAuthController.loginPharmacy(req, res, makeNext());
    const payload = res.json.mock.calls[0][0];
    expect(payload.pharmacy.accountState.vendorModeEnabled).toBe(true);
    expect(payload.pharmacy.accountState.vendorId).toBe('vendor-1');
  });

  test('returns pharmacy: null when the user has no pharmacy profile yet', async () => {
    pharmacyRegistrationService.getPharmacyProfile = jest.fn().mockResolvedValue(null);
    const req = { body: { email: 'x@x.com', password: 'pw', deviceFingerprint: 'fp' }, headers: {} };
    const res = makeRes();
    await pharmacyAuthController.loginPharmacy(req, res, makeNext());
    const payload = res.json.mock.calls[0][0];
    expect(payload.pharmacy).toBeNull();
  });

  test('accountState surfaces the "under_review" stage with no pending actions', async () => {
    pharmacyRegistrationService.getPharmacyProfile = jest.fn().mockResolvedValue(makePharmacy({ verificationStatus: 'under_review' }));
    const req = { body: { email: 'x@x.com', password: 'pw', deviceFingerprint: 'fp' }, headers: {} };
    const res = makeRes();
    await pharmacyAuthController.loginPharmacy(req, res, makeNext());
    const payload = res.json.mock.calls[0][0];
    expect(payload.pharmacy.accountState).toEqual(expect.objectContaining({ stage: 'under_review', isApproved: false, pendingActions: [] }));
  });

  test('accountState surfaces "rejected" with an upload_documents prompt', async () => {
    pharmacyRegistrationService.getPharmacyProfile = jest.fn().mockResolvedValue(makePharmacy({ verificationStatus: 'rejected' }));
    const req = { body: { email: 'x@x.com', password: 'pw', deviceFingerprint: 'fp' }, headers: {} };
    const res = makeRes();
    await pharmacyAuthController.loginPharmacy(req, res, makeNext());
    const payload = res.json.mock.calls[0][0];
    expect(payload.pharmacy.accountState).toEqual(expect.objectContaining({ stage: 'rejected', pendingActions: ['upload_documents'] }));
  });

  test('rewrites authService "Invalid credentials" into a friendlier message', async () => {
    authService.login = jest.fn().mockRejectedValue(new Error('Invalid credentials'));
    const req = { body: { email: 'x@x.com', password: 'pw', deviceFingerprint: 'fp' }, headers: {} };
    const res = makeRes();
    await pharmacyAuthController.loginPharmacy(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email or password' });
  });

  test('forwards an unrelated authService error to next()', async () => {
    authService.login = jest.fn().mockRejectedValue(new Error('token service down'));
    const req = { body: { email: 'x@x.com', password: 'pw', deviceFingerprint: 'fp' }, headers: {} };
    const res = makeRes();
    const next = makeNext();
    await pharmacyAuthController.loginPharmacy(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ============================================================================
// getPharmacyProfile
// ============================================================================

describe('getPharmacyProfile', () => {
  test('returns 404 when there is no pharmacy profile', async () => {
    pharmacyRegistrationService.getPharmacyProfile = jest.fn().mockResolvedValue(null);
    const req = { user: { sub: USER_ID } };
    const res = makeRes();
    await pharmacyAuthController.getPharmacyProfile(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns user + pharmacy + accountState on success', async () => {
    const req = { user: { sub: USER_ID } };
    const res = makeRes();
    await pharmacyAuthController.getPharmacyProfile(req, res, makeNext());
    expect(res.status).not.toHaveBeenCalledWith(404);
    const payload = res.json.mock.calls[0][0];
    expect(payload.user.id).toBe(USER_ID);
    expect(payload.pharmacy.accountState.isApproved).toBe(true);
  });

  test('forwards a service error to next()', async () => {
    pharmacyRegistrationService.getPharmacyProfile = jest.fn().mockRejectedValue(new Error('boom'));
    const req = { user: { sub: USER_ID } };
    const res = makeRes();
    const next = makeNext();
    await pharmacyAuthController.getPharmacyProfile(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ============================================================================
// verifyEmail
// ============================================================================

describe('verifyEmail', () => {
  test('400s when token is missing', async () => {
    const req = { query: {} };
    const res = makeRes();
    await pharmacyAuthController.verifyEmail(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400s on an unknown token', async () => {
    emailVerRepo.findByToken = jest.fn().mockResolvedValue(null);
    const req = { query: { token: 'bad' } };
    const res = makeRes();
    await pharmacyAuthController.verifyEmail(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid or expired verification token' });
  });

  test('200s idempotently when the token was already used', async () => {
    emailVerRepo.findByToken = jest.fn().mockResolvedValue({ usedAt: new Date(), expiresAt: new Date(Date.now() + 100000) });
    const req = { query: { token: 'tok' } };
    const res = makeRes();
    await pharmacyAuthController.verifyEmail(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Email already verified.' });
    expect(emailVerRepo.save).not.toHaveBeenCalled();
  });

  test('400s when the token has expired', async () => {
    emailVerRepo.findByToken = jest.fn().mockResolvedValue({ usedAt: null, expiresAt: new Date(Date.now() - 1000) });
    const req = { query: { token: 'tok' } };
    const res = makeRes();
    await pharmacyAuthController.verifyEmail(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Verification token has expired. Request a new one.' });
  });

  test('marks the token used and confirms the application is under review', async () => {
    const ev = { usedAt: null, expiresAt: new Date(Date.now() + 100000) };
    emailVerRepo.findByToken = jest.fn().mockResolvedValue(ev);
    const req = { query: { token: 'tok' } };
    const res = makeRes();
    await pharmacyAuthController.verifyEmail(req, res, makeNext());
    expect(ev.usedAt).toBeInstanceOf(Date);
    expect(emailVerRepo.save).toHaveBeenCalledWith(ev);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: expect.stringContaining('under review') }));
  });
});

// ============================================================================
// resendVerification
// ============================================================================

describe('resendVerification', () => {
  test('400s when email is missing', async () => {
    const req = { body: {} };
    const res = makeRes();
    await pharmacyAuthController.resendVerification(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(verificationService.resendVerificationEmail).not.toHaveBeenCalled();
  });

  test('200s with a generic message on success (no email enumeration)', async () => {
    const req = { body: { email: 'x@x.com' } };
    const res = makeRes();
    await pharmacyAuthController.resendVerification(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('200s "already verified" when the service reports ALREADY_VERIFIED', async () => {
    const err = new Error('already verified');
    err.code = 'ALREADY_VERIFIED';
    verificationService.resendVerificationEmail = jest.fn().mockRejectedValue(err);
    const req = { body: { email: 'x@x.com' } };
    const res = makeRes();
    await pharmacyAuthController.resendVerification(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Email is already verified. You can log in.' });
  });

  test('429s when the service reports rate limiting ("Too many...")', async () => {
    verificationService.resendVerificationEmail = jest.fn().mockRejectedValue(new Error('Too many requests, try later'));
    const req = { body: { email: 'x@x.com' } };
    const res = makeRes();
    await pharmacyAuthController.resendVerification(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('forwards an unrelated error to next()', async () => {
    verificationService.resendVerificationEmail = jest.fn().mockRejectedValue(new Error('SMTP down'));
    const req = { body: { email: 'x@x.com' } };
    const res = makeRes();
    const next = makeNext();
    await pharmacyAuthController.resendVerification(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ============================================================================
// changePassword
// ============================================================================

describe('changePassword', () => {
  test('400s when currentPassword or newPassword is missing', async () => {
    const req = { user: { sub: USER_ID }, body: { currentPassword: 'old' } };
    const res = makeRes();
    await pharmacyAuthController.changePassword(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400s when newPassword is under 8 characters', async () => {
    const req = { user: { sub: USER_ID }, body: { currentPassword: 'old', newPassword: 'short' } };
    const res = makeRes();
    await pharmacyAuthController.changePassword(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test('404s when the user cannot be found', async () => {
    userRepo.findById = jest.fn().mockResolvedValue(null);
    const req = { user: { sub: USER_ID }, body: { currentPassword: 'old', newPassword: 'newpassword' } };
    const res = makeRes();
    await pharmacyAuthController.changePassword(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('400s when currentPassword does not match', async () => {
    bcrypt.compare = jest.fn().mockResolvedValue(false);
    const req = { user: { sub: USER_ID }, body: { currentPassword: 'wrong', newPassword: 'newpassword' } };
    const res = makeRes();
    await pharmacyAuthController.changePassword(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Current password is incorrect' });
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  test('hashes and saves the new password on success', async () => {
    const req = { user: { sub: USER_ID }, body: { currentPassword: 'old', newPassword: 'newpassword' } };
    const res = makeRes();
    await pharmacyAuthController.changePassword(req, res, makeNext());
    expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 12);
    expect(userRepo.update).toHaveBeenCalledWith(USER_ID, { passwordHash: 'new-hashed' });
    // No explicit res.status() call on this success path — Express defaults to 200.
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Password changed successfully' });
  });
});

// ============================================================================
// updateAccountSettings
// ============================================================================

describe('updateAccountSettings', () => {
  test('400s when the new email is already used by a different pharmacy account', async () => {
    userRepo.findByEmailAndRole = jest.fn().mockResolvedValue({ id: 'someone-else' });
    const req = { user: { sub: USER_ID }, body: { email: 'taken@x.com' } };
    const res = makeRes();
    await pharmacyAuthController.updateAccountSettings(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  test('allows keeping your own current email unchanged', async () => {
    userRepo.findByEmailAndRole = jest.fn().mockResolvedValue({ id: USER_ID });
    const req = { user: { sub: USER_ID }, body: { email: 'me@x.com' } };
    const res = makeRes();
    await pharmacyAuthController.updateAccountSettings(req, res, makeNext());
    // No explicit res.status() call on this success path — Express defaults to 200.
    expect(res.status).not.toHaveBeenCalled();
    expect(userRepo.update).toHaveBeenCalledWith(USER_ID, { email: 'me@x.com' });
  });

  test('400s when there is nothing to update', async () => {
    const req = { user: { sub: USER_ID }, body: {} };
    const res = makeRes();
    await pharmacyAuthController.updateAccountSettings(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Nothing to update' });
  });

  test('updates fullName only', async () => {
    const req = { user: { sub: USER_ID }, body: { fullName: '  New Name  ' } };
    const res = makeRes();
    await pharmacyAuthController.updateAccountSettings(req, res, makeNext());
    expect(userRepo.update).toHaveBeenCalledWith(USER_ID, { fullName: 'New Name' });
  });
});

// ============================================================================
// getPharmacyById — public listing endpoint, approved-only
// ============================================================================

describe('getPharmacyById', () => {
  test('404s when the pharmacy does not exist', async () => {
    pharmacyProfileRepo.findById = jest.fn().mockResolvedValue(null);
    const req = { params: { id: PHARMACY_ID } };
    const res = makeRes();
    await pharmacyAuthController.getPharmacyById(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('404s for a pharmacy that exists but is not yet approved (hides unapproved pharmacies from public listing)', async () => {
    pharmacyProfileRepo.findById = jest.fn().mockResolvedValue(makePharmacy({ verificationStatus: 'pending' }));
    const req = { params: { id: PHARMACY_ID } };
    const res = makeRes();
    await pharmacyAuthController.getPharmacyById(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200s with vendorId when an approved pharmacy has a hybrid VendorProfile', async () => {
    AppDataSource.getRepository = jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue({ id: 'vendor-1' }) });
    const req = { params: { id: PHARMACY_ID } };
    const res = makeRes();
    await pharmacyAuthController.getPharmacyById(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.pharmacy.vendorId).toBe('vendor-1');
  });
});

// ============================================================================
// forgotPassword / resetPassword
// ============================================================================

describe('forgotPassword', () => {
  test('400s when email is missing', async () => {
    const req = { body: {} };
    const res = makeRes();
    await pharmacyAuthController.forgotPassword(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("200s with a generic message (doesn't leak whether the email exists)", async () => {
    const req = { body: { email: 'x@x.com' } };
    const res = makeRes();
    await pharmacyAuthController.forgotPassword(req, res, makeNext());
    expect(passwordResetService.requestReset).toHaveBeenCalledWith('x@x.com', 'pharmacy');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('resetPassword', () => {
  test('400s when token or newPassword is missing', async () => {
    const req = { body: { token: 'tok' } };
    const res = makeRes();
    await pharmacyAuthController.resetPassword(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400s when newPassword is under 8 characters', async () => {
    const req = { body: { token: 'tok', newPassword: 'short' } };
    const res = makeRes();
    await pharmacyAuthController.resetPassword(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(passwordResetService.resetPassword).not.toHaveBeenCalled();
  });

  test('200s on success', async () => {
    const req = { body: { token: 'tok', newPassword: 'newpassword' } };
    const res = makeRes();
    await pharmacyAuthController.resetPassword(req, res, makeNext());
    expect(passwordResetService.resetPassword).toHaveBeenCalledWith('tok', 'newpassword');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ============================================================================
// uploadProfileLogo
// ============================================================================

describe('uploadProfileLogo', () => {
  test('400s when no file was uploaded', async () => {
    const req = { user: { sub: USER_ID }, savedFiles: [] };
    const res = makeRes();
    await pharmacyAuthController.uploadProfileLogo(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('200s and updates both the pharmacy logo and the user profileImageUrl', async () => {
    pharmacyProfileRepo.updateLogoUrl = jest.fn().mockResolvedValue(undefined);
    const req = { user: { sub: USER_ID }, savedFiles: [{ id: 'file-1', fileUrl: 'http://cdn/logo.png' }] };
    const res = makeRes();
    await pharmacyAuthController.uploadProfileLogo(req, res, makeNext());
    expect(pharmacyProfileRepo.updateLogoUrl).toHaveBeenCalledWith(USER_ID, 'http://cdn/logo.png');
    expect(userRepo.update).toHaveBeenCalledWith(USER_ID, { profileImageUrl: 'http://cdn/logo.png' });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ============================================================================
// Thin delegation: pricing, staff, listing (light pass)
// ============================================================================

describe('thin delegation endpoints', () => {
  test('getPricingFeeTypes returns the static fee-type list', async () => {
    const req = {};
    const res = makeRes();
    await pharmacyAuthController.getPricingFeeTypes(req, res, makeNext());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.any(Array) }));
  });

  test('getStaffRoles returns the static role list', async () => {
    const req = {};
    const res = makeRes();
    await pharmacyAuthController.getStaffRoles(req, res, makeNext());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.any(Array) }));
  });

  test('setPricing delegates to the service and returns 201', async () => {
    const req = { user: { sub: USER_ID }, body: { feeType: 'delivery', amount: 500 } };
    const res = makeRes();
    await pharmacyAuthController.setPricing(req, res, makeNext());
    expect(pharmacyRegistrationService.setPricing).toHaveBeenCalledWith(USER_ID, req.body);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('getPricing delegates to the service', async () => {
    const req = { user: { sub: USER_ID } };
    const res = makeRes();
    await pharmacyAuthController.getPricing(req, res, makeNext());
    expect(pharmacyRegistrationService.getPricing).toHaveBeenCalledWith(USER_ID);
  });

  test('deletePricing delegates with the id param', async () => {
    const req = { user: { sub: USER_ID }, params: { id: 'price-1' } };
    const res = makeRes();
    await pharmacyAuthController.deletePricing(req, res, makeNext());
    expect(pharmacyRegistrationService.deletePricing).toHaveBeenCalledWith(USER_ID, 'price-1');
  });

  test('addStaff delegates and returns 201', async () => {
    const req = { user: { sub: USER_ID }, body: { email: 'staff@x.com', role: 'pharmacist' } };
    const res = makeRes();
    await pharmacyAuthController.addStaff(req, res, makeNext());
    expect(pharmacyRegistrationService.addStaffMember).toHaveBeenCalledWith(USER_ID, req.body);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('getStaff delegates to the service', async () => {
    const req = { user: { sub: USER_ID } };
    const res = makeRes();
    await pharmacyAuthController.getStaff(req, res, makeNext());
    expect(pharmacyRegistrationService.getStaffMembers).toHaveBeenCalledWith(USER_ID);
  });

  test('removeStaff delegates with the staff user id', async () => {
    const req = { user: { sub: USER_ID }, params: { id: 'staff-1' } };
    const res = makeRes();
    await pharmacyAuthController.removeStaff(req, res, makeNext());
    expect(pharmacyRegistrationService.removeStaffMember).toHaveBeenCalledWith(USER_ID, 'staff-1');
  });

  test('getAllPharmacies passes query params through and shapes the response', async () => {
    pharmacyRegistrationService.getAllPharmacies = jest.fn().mockResolvedValue([makePharmacy({ user: makeUser() })]);
    const req = { query: { page: '2', limit: '10', verificationStatus: 'approved' } };
    const res = makeRes();
    await pharmacyAuthController.getAllPharmacies(req, res, makeNext());
    expect(pharmacyRegistrationService.getAllPharmacies).toHaveBeenCalledWith({ page: '2', limit: '10', verificationStatus: 'approved' });
    const payload = res.json.mock.calls[0][0];
    expect(payload.data[0].id).toBe(PHARMACY_ID);
  });

  test('updatePharmacyProfile delegates to the service', async () => {
    const req = { user: { sub: USER_ID }, body: { description: 'New description' } };
    const res = makeRes();
    await pharmacyAuthController.updatePharmacyProfile(req, res, makeNext());
    expect(pharmacyRegistrationService.updatePharmacyProfile).toHaveBeenCalledWith(USER_ID, req.body);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
