/* eslint-env jest */
// Unit tests for VendorAuthService — registration (transactional User +
// VendorProfile + VendorVerificationRequest creation), profile reads/updates,
// document upload, and logo upload.
//
// Desync-risk check (mirrors the doctor-verification-status bug that started
// this testing effort): registration writes THREE things in one DB
// transaction — users.status, vendor_profiles.verificationStatus, and a
// vendor_verification_requests row — and the tests below pin the exact
// initial values of all three so they can never silently drift apart at
// creation time. Separately: a full repo-wide search turned up NO code path
// anywhere (this service, its controller, or admin-ops) that ever transitions
// vendor_profiles.verificationStatus to "approved" or users.status to
// "vendor_active" — vendorAuthController.js's buildVendorAccountState() reads
// and branches on both fields, but nothing ever writes them past their
// initial "pending"/"pending_email_verification" values. Unlike doctors
// (doctorVerificationService.approveVerification) and pharmacies
// (pharmacyVerificationService), vendors have no admin-approval service at
// all yet — this isn't a desync bug in existing code so much as a missing
// feature; flagged here since it's exactly the failure class this round of
// testing was told to look for.

jest.mock('../../../../config/database');
jest.mock('../../repositories/vendorRepository');
jest.mock('../../../auth/services/verificationService');
jest.mock('../../../auth/services/referralService');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('bcryptjs');

const AppDataSource = require('../../../../config/database');
const vendorRepository = require('../../repositories/vendorRepository');
const verificationService = require('../../../auth/services/verificationService');
const referralService = require('../../../auth/services/referralService');
const userRepository = require('../../../auth/repositories/userRepository');
const bcrypt = require('bcryptjs');

const vendorAuthService = require('../vendorAuthService');

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VENDOR_ID = 'bbbb0000-0000-0000-0000-000000000002';

function makeRegistrationData(overrides = {}) {
  return {
    fullName: 'Vee Endor',
    email: 'Vendor@Example.com',
    password: 'supersecret',
    phoneNumber: '08012345678',
    businessName: 'Vee Shop',
    businessCategory: 'health_wellness',
    businessEmail: 'Biz@Example.com',
    businessPhone: '08087654321',
    country: 'Nigeria',
    state: 'Lagos',
    city: 'Lagos',
    fullAddress: '1 Main St',
    businessWebsite: null,
    businessDescription: 'We sell things',
    countryCode: 'NG',
    ...overrides,
  };
}

function makeManager() {
  const savedUser = { id: USER_ID, email: 'vendor@example.com' };
  const savedVendor = { id: VENDOR_ID, userId: USER_ID, verificationStatus: 'pending' };
  const saveMock = jest.fn().mockImplementation((entityName, data) => {
    if (entityName === 'User') return Promise.resolve({ ...savedUser, ...data });
    if (entityName === 'VendorProfile') return Promise.resolve({ ...savedVendor, ...data });
    return Promise.resolve({ id: 'other', ...data });
  });
  return { save: saveMock };
}

function makeQueryRunner() {
  const manager = makeManager();
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  AppDataSource.createQueryRunner = jest.fn(() => makeQueryRunner());
  AppDataSource.getRepository = jest.fn().mockReturnValue({
    update: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
  });

  userRepository.findByEmailAndRole = jest.fn().mockResolvedValue(null);
  userRepository.findById = jest.fn().mockResolvedValue({ id: USER_ID, fullName: 'Vee Endor' });

  vendorRepository.findByBusinessEmail = jest.fn().mockResolvedValue(null);
  vendorRepository.findByUserId = jest.fn().mockResolvedValue({
    id: VENDOR_ID, userId: USER_ID, verificationStatus: 'pending', documentsSubmitted: false,
  });
  vendorRepository.saveDocument = jest.fn().mockImplementation((data) => Promise.resolve({ id: 'doc-1', ...data }));
  vendorRepository.findAllPaginated = jest.fn().mockResolvedValue({ vendors: [], total: 0, page: 1, limit: 20 });

  bcrypt.hash = jest.fn().mockResolvedValue('hashed-password');

  verificationService.sendEmailVerification = jest.fn().mockResolvedValue(undefined);
  referralService.createReferralCode = jest.fn().mockResolvedValue(undefined);
});

// ============================================================================
// SUITE 1 - registerVendor: the transactional core + the three initial states
// ============================================================================

describe('registerVendor', () => {
  test('throws when the email is already registered as a vendor', async () => {
    userRepository.findByEmailAndRole = jest.fn().mockResolvedValue({ id: 'existing' });
    await expect(vendorAuthService.registerVendor(makeRegistrationData())).rejects.toThrow('Email already in use');
    expect(AppDataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  test('throws when the business email is already registered', async () => {
    vendorRepository.findByBusinessEmail = jest.fn().mockResolvedValue({ id: 'existing-vendor' });
    await expect(vendorAuthService.registerVendor(makeRegistrationData())).rejects.toThrow('Business email already registered');
  });

  test('normalizes email and businessEmail to lowercase/trimmed before checking and saving', async () => {
    await vendorAuthService.registerVendor(makeRegistrationData({ email: '  Vendor@Example.com  ', businessEmail: ' Biz@Example.COM ' }));

    expect(userRepository.findByEmailAndRole).toHaveBeenCalledWith('vendor@example.com', 'vendor');
    expect(vendorRepository.findByBusinessEmail).toHaveBeenCalledWith('biz@example.com');
  });

  test('creates User (pending_email_verification), VendorProfile (pending, inactive), and an initial VendorVerificationRequest (pending) all inside one transaction', async () => {
    const qr = makeQueryRunner();
    AppDataSource.createQueryRunner = jest.fn(() => qr);

    const result = await vendorAuthService.registerVendor(makeRegistrationData());

    expect(qr.startTransaction).toHaveBeenCalledTimes(1);
    expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
    expect(qr.rollbackTransaction).not.toHaveBeenCalled();

    const userSaveCall = qr.manager.save.mock.calls.find((c) => c[0] === 'User');
    expect(userSaveCall[1]).toMatchObject({
      role: 'vendor',
      status: 'pending_email_verification',
      email: 'vendor@example.com',
    });

    const vendorSaveCall = qr.manager.save.mock.calls.find((c) => c[0] === 'VendorProfile');
    expect(vendorSaveCall[1]).toMatchObject({
      verificationStatus: 'pending',
      isActive: false,
      documentsSubmitted: false,
      isHybridPharmacy: false,
    });

    const requestSaveCall = qr.manager.save.mock.calls.find((c) => c[0] === 'VendorVerificationRequest');
    expect(requestSaveCall[1]).toMatchObject({
      requestType: 'initial_verification',
      status: 'pending',
    });

    // The verification request must reference the SAME vendor row just created —
    // this is exactly the kind of cross-reference that can drift if the two
    // writes are ever split apart.
    expect(requestSaveCall[1].vendorId).toBe(VENDOR_ID);
    expect(result.emailSent).toBe(true);
  });

  test('rolls back the whole transaction on a unique-constraint violation and maps it to a friendly error (email)', async () => {
    const qr = makeQueryRunner();
    qr.manager.save = jest.fn().mockRejectedValue({ code: '23505', detail: 'Key (email)=(x) already exists.' });
    AppDataSource.createQueryRunner = jest.fn(() => qr);

    await expect(vendorAuthService.registerVendor(makeRegistrationData())).rejects.toThrow('Email already in use');
    expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(qr.release).toHaveBeenCalledTimes(1);
  });

  test('rolls back and maps a businessEmail unique-constraint violation', async () => {
    const qr = makeQueryRunner();
    qr.manager.save = jest.fn().mockRejectedValue({ code: '23505', detail: 'Key (businessEmail)=(x) already exists.' });
    AppDataSource.createQueryRunner = jest.fn(() => qr);

    await expect(vendorAuthService.registerVendor(makeRegistrationData())).rejects.toThrow('Business email already registered');
  });

  test('rolls back and rethrows an unrelated DB error unchanged', async () => {
    const qr = makeQueryRunner();
    const dbError = new Error('connection terminated');
    qr.manager.save = jest.fn().mockRejectedValue(dbError);
    AppDataSource.createQueryRunner = jest.fn(() => qr);

    await expect(vendorAuthService.registerVendor(makeRegistrationData())).rejects.toThrow('connection terminated');
    expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  test('always releases the query runner, even after a rollback', async () => {
    const qr = makeQueryRunner();
    qr.manager.save = jest.fn().mockRejectedValue(new Error('boom'));
    AppDataSource.createQueryRunner = jest.fn(() => qr);

    await expect(vendorAuthService.registerVendor(makeRegistrationData())).rejects.toThrow();
    expect(qr.release).toHaveBeenCalledTimes(1);
  });

  test('registration still succeeds when the verification email fails to send (emailSent=false)', async () => {
    verificationService.sendEmailVerification = jest.fn().mockRejectedValue(new Error('SMTP down'));
    const result = await vendorAuthService.registerVendor(makeRegistrationData());
    expect(result.emailSent).toBe(false);
  });

  test('registration still succeeds when referral code creation fails (non-critical)', async () => {
    referralService.createReferralCode = jest.fn().mockRejectedValue(new Error('referral service down'));
    await expect(vendorAuthService.registerVendor(makeRegistrationData())).resolves.toBeDefined();
  });
});

// ============================================================================
// SUITE 2 - getVendorProfile / updateVendorProfile
// ============================================================================

describe('getVendorProfile', () => {
  test('throws when no vendor profile exists for this user', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(vendorAuthService.getVendorProfile(USER_ID)).rejects.toThrow('Vendor profile not found');
  });

  test('returns both vendor and user records', async () => {
    const result = await vendorAuthService.getVendorProfile(USER_ID);
    expect(result.vendor.id).toBe(VENDOR_ID);
    expect(result.user.id).toBe(USER_ID);
  });
});

describe('updateVendorProfile', () => {
  test('throws when no vendor profile exists', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(vendorAuthService.updateVendorProfile(USER_ID, { businessName: 'x' })).rejects.toThrow('Vendor profile not found');
  });

  test('only mutates whitelisted fields on the vendor entity before saving', async () => {
    const vendor = { id: VENDOR_ID, businessName: 'Old', verificationStatus: 'approved' };
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(vendor);
    const savedRepo = { save: jest.fn().mockImplementation((v) => Promise.resolve(v)) };
    AppDataSource.getRepository = jest.fn().mockReturnValue(savedRepo);

    await vendorAuthService.updateVendorProfile(USER_ID, {
      businessName: 'New Name', verificationStatus: 'approved', isActive: true,
    });

    expect(savedRepo.save).toHaveBeenCalledWith(expect.objectContaining({ businessName: 'New Name' }));
    // verificationStatus/isActive are not in the allowed-fields list — must be untouched by this path
    expect(vendor.isActive).toBeUndefined();
  });

  test('also updates the User.fullName when fullName is provided', async () => {
    const updateRepo = { update: jest.fn().mockResolvedValue(undefined) };
    const vendorRepo = { save: jest.fn().mockImplementation((v) => Promise.resolve(v)) };
    AppDataSource.getRepository = jest.fn((name) => (name === 'User' ? updateRepo : vendorRepo));

    await vendorAuthService.updateVendorProfile(USER_ID, { fullName: 'New Full Name' });

    expect(updateRepo.update).toHaveBeenCalledWith(USER_ID, { fullName: 'New Full Name' });
  });

  test('does not touch the User table when fullName is not provided', async () => {
    const updateRepo = { update: jest.fn().mockResolvedValue(undefined) };
    const vendorRepo = { save: jest.fn().mockImplementation((v) => Promise.resolve(v)) };
    AppDataSource.getRepository = jest.fn((name) => (name === 'User' ? updateRepo : vendorRepo));

    await vendorAuthService.updateVendorProfile(USER_ID, { businessName: 'x' });

    expect(updateRepo.update).not.toHaveBeenCalled();
  });
});

// ============================================================================
// SUITE 3 - uploadVendorLogo / uploadDocuments
// ============================================================================

describe('uploadVendorLogo', () => {
  test('throws when no vendor profile exists', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(vendorAuthService.uploadVendorLogo(USER_ID, 'http://x/logo.png')).rejects.toThrow('Vendor profile not found');
  });

  test('updates both VendorProfile.logoUrl and User.profileImageUrl to the same URL', async () => {
    const vendorRepo = { update: jest.fn().mockResolvedValue(undefined) };
    const userRepo = { update: jest.fn().mockResolvedValue(undefined) };
    AppDataSource.getRepository = jest.fn((name) => (name === 'User' ? userRepo : vendorRepo));

    const result = await vendorAuthService.uploadVendorLogo(USER_ID, 'http://x/logo.png');

    expect(vendorRepo.update).toHaveBeenCalledWith(VENDOR_ID, { logoUrl: 'http://x/logo.png' });
    expect(userRepo.update).toHaveBeenCalledWith(USER_ID, { profileImageUrl: 'http://x/logo.png' });
    expect(result.logoUrl).toBe('http://x/logo.png');
  });
});

describe('uploadDocuments', () => {
  test('throws when no vendor profile exists', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(vendorAuthService.uploadDocuments(USER_ID, [])).rejects.toThrow('Vendor profile not found');
  });

  test('saves every document and flips the vendor to documents_required for review', async () => {
    const vendorRepo = { update: jest.fn().mockResolvedValue(undefined) };
    AppDataSource.getRepository = jest.fn().mockReturnValue(vendorRepo);

    const docs = [
      { documentType: 'government_id', documentUrl: 'http://x/id.png' },
      { documentType: 'business_registration', documentUrl: 'http://x/reg.png' },
    ];
    const saved = await vendorAuthService.uploadDocuments(USER_ID, docs);

    expect(saved).toHaveLength(2);
    expect(vendorRepository.saveDocument).toHaveBeenCalledTimes(2);
    expect(vendorRepo.update).toHaveBeenCalledWith(VENDOR_ID, {
      documentsSubmitted: true,
      verificationStatus: 'documents_required',
    });
  });
});

describe('getAllVendors', () => {
  test('delegates straight to the repository', async () => {
    await vendorAuthService.getAllVendors({ page: 2, limit: 10 });
    expect(vendorRepository.findAllPaginated).toHaveBeenCalledWith({ page: 2, limit: 10 });
  });
});
