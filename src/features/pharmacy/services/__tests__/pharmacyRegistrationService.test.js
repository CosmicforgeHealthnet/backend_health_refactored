/* eslint-env jest */
// Unit tests for pharmacyRegistrationService — pharmacy account/profile
// registration (transactional), document upload, pricing, and staff
// management.
//
// Focus: the registration transaction (User + PharmacyProfile +
// PharmacyVerificationRequest must all commit or all roll back), unique
// constraint error remapping, and that staff-role validation actually
// restricts to the allowed set (a staff account is a real login credential).

jest.mock('../../../../config/database');
jest.mock('../../repositories/pharmacyProfileRepository');
jest.mock('../../repositories/pharmacyDocumentRepository');
jest.mock('../../repositories/pharmacyVerificationRepository');
jest.mock('../../repositories/pharmacyPricingRepository');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('../../../auth/services/verificationService');
jest.mock('../../../auth/services/referralService');
jest.mock('../../../payments/services/currencyService');
jest.mock('../../../../shared/services/email/helper/pharmacy');
jest.mock('bcryptjs');

const AppDataSource       = require('../../../../config/database');
const pharmacyProfileRepo = require('../../repositories/pharmacyProfileRepository');
const pharmacyDocumentRepo = require('../../repositories/pharmacyDocumentRepository');
const pharmacyVerificationRepo = require('../../repositories/pharmacyVerificationRepository');
const pharmacyPricingRepo = require('../../repositories/pharmacyPricingRepository');
const userRepo            = require('../../../auth/repositories/userRepository');
const verificationService = require('../../../auth/services/verificationService');
const referralService     = require('../../../auth/services/referralService');
const CurrencyService     = require('../../../payments/services/currencyService');
const pharmacyStaffEmail  = require('../../../../shared/services/email/helper/pharmacy');
const bcrypt = require('bcryptjs');

const pharmacyRegistrationService = require('../pharmacyRegistrationService');

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const PHARMACY_ID = 'bbbb0000-0000-0000-0000-000000000002';

const VALID_REGISTRATION = {
  fullName: 'Jane Admin',
  email: 'pharmacy@example.com',
  password: 'password123',
  pharmacyName: 'Test Pharmacy',
  registrationNumber: 'REG-123',
  address: '1 Main St',
  phone: '08000000000',
  primaryContactPerson: 'Jane Admin',
  preferredUsername: 'testpharmacy',
  countryCode: 'NG',
};

function makeQueryRunner() {
  const savedEntities = [];
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      save: jest.fn(async (entity, data) => {
        const saved = { id: `${entity}-id`, ...data };
        savedEntities.push({ entity, data: saved });
        return saved;
      }),
    },
    __savedEntities: savedEntities,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  let lastQr;
  AppDataSource.createQueryRunner = jest.fn(() => { lastQr = makeQueryRunner(); return lastQr; });
  AppDataSource.__getLastQr = () => lastQr;

  userRepo.findByEmailAndRole = jest.fn().mockResolvedValue(null);
  userRepo.findById = jest.fn().mockResolvedValue({ id: USER_ID, pharmacyId: PHARMACY_ID });
  userRepo.save = jest.fn().mockImplementation(async (data) => ({ id: 'staff-1', ...data }));
  userRepo.update = jest.fn().mockResolvedValue(undefined);
  userRepo.repo = { find: jest.fn().mockResolvedValue([]) };

  pharmacyProfileRepo.findByUsername = jest.fn().mockResolvedValue(null);
  pharmacyProfileRepo.findByRegistrationNumber = jest.fn().mockResolvedValue(null);
  pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue({ id: PHARMACY_ID, userId: USER_ID, pharmacyName: 'Test Pharmacy' });
  pharmacyProfileRepo.findAll = jest.fn().mockResolvedValue([]);
  pharmacyProfileRepo.save = jest.fn().mockImplementation(async (data) => data);
  pharmacyProfileRepo.updateVerificationStatus = jest.fn().mockResolvedValue(undefined);
  pharmacyProfileRepo.updateDocumentSubmissionStatus = jest.fn().mockResolvedValue(undefined);

  pharmacyDocumentRepo.save = jest.fn().mockImplementation(async (data) => ({ id: 'doc-1', ...data }));
  pharmacyDocumentRepo.findByPharmacyId = jest.fn().mockResolvedValue([]);

  pharmacyVerificationRepo.findByPharmacyId = jest.fn().mockResolvedValue([]);

  pharmacyPricingRepo.setPricing = jest.fn().mockResolvedValue({ id: 'pricing-1' });
  pharmacyPricingRepo.getPricing = jest.fn().mockResolvedValue([]);
  pharmacyPricingRepo.deletePricing = jest.fn().mockResolvedValue(undefined);

  CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('NGN');
  CurrencyService.isCurrencySupportedByProvider = jest.fn().mockResolvedValue(true);

  verificationService.sendEmailVerification = jest.fn().mockResolvedValue(undefined);
  referralService.createUserReferralCode = jest.fn().mockResolvedValue('REF123');

  // NOTE: pharmacyRegistrationService.js destructures
  // `{ sendPharmacyStaffWelcomeEmail }` out of this module AT REQUIRE TIME, so
  // the service holds a direct reference to the automocked jest.fn() — we
  // must mutate that same function's mock behavior (.mockResolvedValue),
  // not replace the module's property with a brand-new jest.fn(), or the
  // service's already-captured reference won't see the change.
  pharmacyStaffEmail.sendPharmacyStaffWelcomeEmail.mockResolvedValue(undefined);

  bcrypt.hash = jest.fn().mockResolvedValue('hashed-password');
});

// ============================================================================
// registerPharmacy
// ============================================================================

describe('registerPharmacy', () => {
  test('rejects when the email is already registered as a pharmacy account', async () => {
    userRepo.findByEmailAndRole = jest.fn().mockResolvedValue({ id: 'existing' });
    await expect(pharmacyRegistrationService.registerPharmacy(VALID_REGISTRATION)).rejects.toThrow('Email already in use');
  });

  test('rejects when the preferred username is taken', async () => {
    pharmacyProfileRepo.findByUsername = jest.fn().mockResolvedValue({ id: 'existing' });
    await expect(pharmacyRegistrationService.registerPharmacy(VALID_REGISTRATION)).rejects.toThrow('Username already taken');
  });

  test('rejects when the registration number already exists', async () => {
    pharmacyProfileRepo.findByRegistrationNumber = jest.fn().mockResolvedValue({ id: 'existing' });
    await expect(pharmacyRegistrationService.registerPharmacy(VALID_REGISTRATION)).rejects.toThrow('Registration number already exists');
  });

  test('commits User + PharmacyProfile + PharmacyVerificationRequest together in one transaction', async () => {
    await pharmacyRegistrationService.registerPharmacy(VALID_REGISTRATION);

    const qr = AppDataSource.__getLastQr();
    expect(qr.startTransaction).toHaveBeenCalled();
    expect(qr.commitTransaction).toHaveBeenCalled();
    expect(qr.rollbackTransaction).not.toHaveBeenCalled();

    const entities = qr.__savedEntities.map((e) => e.entity);
    expect(entities).toEqual(['User', 'PharmacyProfile', 'PharmacyVerificationRequest']);

    const userSave = qr.__savedEntities.find((e) => e.entity === 'User').data;
    expect(userSave).toMatchObject({ role: 'pharmacy', status: 'pending_email_verification', email: 'pharmacy@example.com' });

    const profileSave = qr.__savedEntities.find((e) => e.entity === 'PharmacyProfile').data;
    expect(profileSave).toMatchObject({ verificationStatus: 'pending', documentsSubmitted: false });

    const reqSave = qr.__savedEntities.find((e) => e.entity === 'PharmacyVerificationRequest').data;
    expect(reqSave).toMatchObject({ status: 'pending', requestType: 'initial_verification' });
  });

  test('rolls back the entire transaction and releases the connection when a write fails partway through', async () => {
    AppDataSource.createQueryRunner = jest.fn(() => {
      const qr = makeQueryRunner();
      qr.manager.save = jest.fn()
        .mockResolvedValueOnce({ id: 'user-1' })              // User succeeds
        .mockRejectedValueOnce(new Error('profile save failed')); // PharmacyProfile fails
      AppDataSource.__getLastQr = () => qr;
      return qr;
    });

    await expect(pharmacyRegistrationService.registerPharmacy(VALID_REGISTRATION)).rejects.toThrow('profile save failed');

    const qr = AppDataSource.__getLastQr();
    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(qr.commitTransaction).not.toHaveBeenCalled();
    expect(qr.release).toHaveBeenCalled();
  });

  test('remaps a unique-constraint DB error on email to a friendly message', async () => {
    AppDataSource.createQueryRunner = jest.fn(() => {
      const qr = makeQueryRunner();
      qr.manager.save = jest.fn().mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505', detail: 'Key (email)=(x) already exists.' }));
      return qr;
    });
    await expect(pharmacyRegistrationService.registerPharmacy(VALID_REGISTRATION)).rejects.toThrow('Email already in use');
  });

  test('remaps a unique-constraint DB error on registrationNumber to a friendly message', async () => {
    AppDataSource.createQueryRunner = jest.fn(() => {
      const qr = makeQueryRunner();
      qr.manager.save = jest.fn().mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505', detail: 'Key (registrationNumber)=(x) already exists.' }));
      return qr;
    });
    await expect(pharmacyRegistrationService.registerPharmacy(VALID_REGISTRATION)).rejects.toThrow('Registration number already exists');
  });

  test('registration still succeeds even when the verification email fails to send', async () => {
    verificationService.sendEmailVerification = jest.fn().mockRejectedValue(new Error('smtp down'));
    const result = await pharmacyRegistrationService.registerPharmacy(VALID_REGISTRATION);
    expect(result.emailSent).toBe(false);
  });

  test('registration still succeeds even when referral code creation fails', async () => {
    referralService.createUserReferralCode = jest.fn().mockRejectedValue(new Error('referral service down'));
    await expect(pharmacyRegistrationService.registerPharmacy(VALID_REGISTRATION)).resolves.toBeDefined();
  });

  test('resolves defaultCurrency from the pharmacy country when a gateway supports it', async () => {
    CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('GHS');
    CurrencyService.isCurrencySupportedByProvider = jest.fn().mockResolvedValue(true);

    await pharmacyRegistrationService.registerPharmacy(VALID_REGISTRATION);

    const qr = AppDataSource.__getLastQr();
    const profileSave = qr.__savedEntities.find((e) => e.entity === 'PharmacyProfile').data;
    expect(profileSave.defaultCurrency).toBe('GHS');
  });

  test('falls back to USD when no gateway supports the local currency', async () => {
    CurrencyService.isCurrencySupportedByProvider = jest.fn().mockResolvedValue(false);
    await pharmacyRegistrationService.registerPharmacy(VALID_REGISTRATION);

    const qr = AppDataSource.__getLastQr();
    const profileSave = qr.__savedEntities.find((e) => e.entity === 'PharmacyProfile').data;
    expect(profileSave.defaultCurrency).toBe('USD');
  });
});

// ============================================================================
// uploadPharmacyDocuments
// ============================================================================

describe('uploadPharmacyDocuments', () => {
  test('throws when the pharmacy does not exist', async () => {
    pharmacyProfileRepo.findById = jest.fn().mockResolvedValue(null);
    await expect(pharmacyRegistrationService.uploadPharmacyDocuments(PHARMACY_ID, [{ fileId: 'f1', documentType: 'license' }]))
      .rejects.toThrow('Pharmacy not found');
  });

  test('saves every document and advances the pharmacy to under_review with documentsSubmitted true', async () => {
    pharmacyProfileRepo.findById = jest.fn().mockResolvedValue({ id: PHARMACY_ID });
    await pharmacyRegistrationService.uploadPharmacyDocuments(PHARMACY_ID, [
      { fileId: 'f1', documentType: 'license', documentName: 'License' },
      { fileId: 'f2', documentType: 'government_id', documentName: 'ID' },
    ]);

    expect(pharmacyDocumentRepo.save).toHaveBeenCalledTimes(2);
    expect(pharmacyProfileRepo.updateVerificationStatus).toHaveBeenCalledWith(PHARMACY_ID, 'under_review');
    expect(pharmacyProfileRepo.updateDocumentSubmissionStatus).toHaveBeenCalledWith(PHARMACY_ID, true);
  });
});

// ============================================================================
// Pricing
// ============================================================================

describe('setPricing / getPricing / deletePricing', () => {
  test('setPricing throws when the pharmacy does not exist', async () => {
    pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(pharmacyRegistrationService.setPricing(USER_ID, { feeType: 'delivery', amount: 500 }))
      .rejects.toThrow('Pharmacy not found');
  });

  test('setPricing accepts a single pricing object', async () => {
    await pharmacyRegistrationService.setPricing(USER_ID, { feeType: 'delivery', amount: 500 });
    expect(pharmacyPricingRepo.setPricing).toHaveBeenCalledWith(PHARMACY_ID, { feeType: 'delivery', amount: 500 });
  });

  test('setPricing accepts an array and sets each entry for the pharmacy', async () => {
    const items = [{ feeType: 'delivery', amount: 500 }, { feeType: 'handling', amount: 100 }];
    await pharmacyRegistrationService.setPricing(USER_ID, items);
    expect(pharmacyPricingRepo.setPricing).toHaveBeenCalledTimes(2);
    expect(pharmacyPricingRepo.setPricing).toHaveBeenCalledWith(PHARMACY_ID, items[0]);
    expect(pharmacyPricingRepo.setPricing).toHaveBeenCalledWith(PHARMACY_ID, items[1]);
  });

  test('deletePricing throws when the pharmacy does not exist', async () => {
    pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(pharmacyRegistrationService.deletePricing(USER_ID, 'pricing-1')).rejects.toThrow('Pharmacy not found');
  });
});

// ============================================================================
// Staff management
// ============================================================================

describe('addStaffMember', () => {
  test('throws when the pharmacy does not exist', async () => {
    pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(pharmacyRegistrationService.addStaffMember(USER_ID, {
      fullName: 'Staff', email: 'staff@example.com', password: 'pw123456', role: 'pharmacist',
    })).rejects.toThrow('Pharmacy not found');
  });

  test.each(['owner', 'admin', 'superadmin', ''])('rejects an invalid staff role "%s"', async (role) => {
    await expect(pharmacyRegistrationService.addStaffMember(USER_ID, {
      fullName: 'Staff', email: 'staff@example.com', password: 'pw123456', role,
    })).rejects.toThrow(/Invalid staff role/);
  });

  test.each(['pharmacist', 'assistant', 'dispatcher', 'pharmacy'])('accepts the valid staff role "%s"', async (role) => {
    await expect(pharmacyRegistrationService.addStaffMember(USER_ID, {
      fullName: 'Staff', email: 'staff@example.com', password: 'pw123456', role,
    })).resolves.toBeDefined();
  });

  test('rejects when the email is already registered for that role', async () => {
    userRepo.findByEmailAndRole = jest.fn().mockResolvedValue({ id: 'existing' });
    await expect(pharmacyRegistrationService.addStaffMember(USER_ID, {
      fullName: 'Staff', email: 'staff@example.com', password: 'pw123456', role: 'pharmacist',
    })).rejects.toThrow('Email already in use');
  });

  test('hashes the password and links the staff account to the pharmacy', async () => {
    await pharmacyRegistrationService.addStaffMember(USER_ID, {
      fullName: 'Staff Member', email: 'staff@example.com', password: 'pw123456', role: 'pharmacist',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('pw123456', 12);
    expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      passwordHash: 'hashed-password', role: 'pharmacist', status: 'active', pharmacyId: PHARMACY_ID,
    }));
  });

  test('staff creation succeeds even when the welcome email fails to send', async () => {
    pharmacyStaffEmail.sendPharmacyStaffWelcomeEmail.mockRejectedValue(new Error('smtp down'));
    await expect(pharmacyRegistrationService.addStaffMember(USER_ID, {
      fullName: 'Staff', email: 'staff@example.com', password: 'pw123456', role: 'pharmacist',
    })).resolves.toBeDefined();
  });
});

describe('removeStaffMember', () => {
  test('throws when the target user is not part of this pharmacy', async () => {
    userRepo.findById = jest.fn().mockResolvedValue({ id: 'staff-1', pharmacyId: 'a-different-pharmacy' });
    await expect(pharmacyRegistrationService.removeStaffMember(USER_ID, 'staff-1'))
      .rejects.toThrow('Staff user not found or not part of your pharmacy');
  });

  test('clears pharmacyId on the staff user', async () => {
    const staffUser = { id: 'staff-1', pharmacyId: PHARMACY_ID };
    userRepo.findById = jest.fn().mockResolvedValue(staffUser);

    await pharmacyRegistrationService.removeStaffMember(USER_ID, 'staff-1');

    expect(staffUser.pharmacyId).toBeNull();
    expect(userRepo.save).toHaveBeenCalledWith(staffUser);
  });
});
