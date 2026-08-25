/* eslint-env jest */
// Unit tests for pharmacyVerificationService — the pharmacy equivalent of
// doctorVerificationService, which is what this whole testing effort exists
// to scrutinize for the doctor-verification-status-desync bug pattern.
//
// STATUS-DESYNC CHECK (the specific thing this file was asked to verify):
// Unlike the doctor flow, pharmacy access gating does NOT read `users.status`
// anywhere. Grepped the whole pharmacy feature (routes, controllers,
// services) plus payments/notifications for any check like
// `user.status === 'pharmacy_active'` or a requireVerifiedPharmacy-style
// middleware — there is none. Every gate (login "accountState", shop
// visibility, order eligibility, prescription assignment) reads
// `PharmacyProfile.verificationStatus` directly, and approvePharmacy/
// rejectPharmacy/requestMoreDocuments here correctly keep
// PharmacyProfile.verificationStatus and PharmacyVerificationRequest.status
// in lockstep (both updated per call, matching _findActiveRequest's lookup).
// So the specific "two fields disagree and one gate reads the stale one"
// failure mode that hit doctors does NOT reproduce here for the
// profile/request pair.
//
// SEPARATE (real, lower-severity) FINDING, not fixed here: `users.status`
// for pharmacy accounts is set to "pending_email_verification" at
// registration (pharmacyRegistrationService.registerPharmacy) and is NEVER
// advanced — pharmacyAuthController.verifyEmail marks the email-verification
// token used but does not touch user.status (contrast with the generic
// authController.verifyEmail, which sets status to "pending_doctor_verification"
// or "active"). So a pharmacy's users.status is permanently stuck at
// "pending_email_verification" even once fully approved. This is surfaced in
// API responses (login, getPharmacyProfile) but — per the grep above — is
// never read by any authorization check, so it has no access-control impact
// today. Left unfixed: it's outside pharmacyVerificationService itself (the
// bug, if any, is in pharmacyAuthController.verifyEmail / registrationService),
// and touching the shared verify-email flow carries more regression risk than
// this cosmetic-data-only issue justifies within this pass. Flagged in the
// final report.

jest.mock('../../../../config/database');
jest.mock('../../repositories/pharmacyProfileRepository');
jest.mock('../../repositories/pharmacyDocumentRepository');
jest.mock('../../repositories/pharmacyVerificationRepository');

const AppDataSource            = require('../../../../config/database');
const pharmacyProfileRepo      = require('../../repositories/pharmacyProfileRepository');
const pharmacyDocumentRepo     = require('../../repositories/pharmacyDocumentRepository');
const pharmacyVerificationRepo = require('../../repositories/pharmacyVerificationRepository');

const pharmacyVerificationService = require('../pharmacyVerificationService');

const PHARMACY_ID = 'aaaa0000-0000-0000-0000-000000000001';
const ADMIN_ID    = 'bbbb0000-0000-0000-0000-000000000002';
const REQUEST_ID  = 'cccc0000-0000-0000-0000-000000000003';

beforeEach(() => {
  jest.clearAllMocks();

  pharmacyVerificationRepo.findPendingRequests = jest.fn().mockResolvedValue([]);
  pharmacyVerificationRepo.findById = jest.fn().mockResolvedValue({ id: REQUEST_ID, status: 'pending' });
  pharmacyVerificationRepo.assignToAdmin = jest.fn().mockResolvedValue(undefined);
  pharmacyVerificationRepo.updateStatus = jest.fn().mockResolvedValue(undefined);
  pharmacyVerificationRepo.findByPharmacyId = jest.fn().mockResolvedValue([
    { id: REQUEST_ID, status: 'in_progress' },
  ]);

  pharmacyProfileRepo.findById = jest.fn().mockResolvedValue({
    id: PHARMACY_ID, userId: 'user-1', pharmacyName: 'Test Pharmacy', email: 'p@example.com',
  });
  pharmacyProfileRepo.updateVerificationStatus = jest.fn().mockResolvedValue(undefined);

  pharmacyDocumentRepo.findByPharmacyId = jest.fn().mockResolvedValue([]);
  pharmacyDocumentRepo.findById = jest.fn().mockResolvedValue({ id: 'doc-1' });
  pharmacyDocumentRepo.updateVerification = jest.fn().mockResolvedValue(undefined);

  AppDataSource.getRepository = jest.fn((name) => {
    if (name === 'VendorProfile') {
      return {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((data) => data),
        save: jest.fn(async (data) => ({ id: 'vendor-1', ...data })),
      };
    }
    if (name === 'VendorWallet') {
      return {
        create: jest.fn((data) => data),
        save: jest.fn().mockResolvedValue(undefined),
      };
    }
    return { findOne: jest.fn().mockResolvedValue(null) };
  });
});

// ============================================================================
// assignVerificationToAdmin
// ============================================================================

describe('assignVerificationToAdmin', () => {
  test('throws when the request does not exist', async () => {
    pharmacyVerificationRepo.findById = jest.fn().mockResolvedValue(null);
    await expect(pharmacyVerificationService.assignVerificationToAdmin(REQUEST_ID, ADMIN_ID))
      .rejects.toThrow('Verification request not found');
  });

  test('throws when the request is not pending', async () => {
    pharmacyVerificationRepo.findById = jest.fn().mockResolvedValue({ id: REQUEST_ID, status: 'in_progress' });
    await expect(pharmacyVerificationService.assignVerificationToAdmin(REQUEST_ID, ADMIN_ID))
      .rejects.toThrow('Verification request is not pending');
  });

  test('assigns a pending request to the admin', async () => {
    await pharmacyVerificationService.assignVerificationToAdmin(REQUEST_ID, ADMIN_ID);
    expect(pharmacyVerificationRepo.assignToAdmin).toHaveBeenCalledWith(REQUEST_ID, ADMIN_ID);
  });
});

// ============================================================================
// verifyDocument
// ============================================================================

describe('verifyDocument', () => {
  test('throws when the document does not exist', async () => {
    pharmacyDocumentRepo.findById = jest.fn().mockResolvedValue(null);
    await expect(pharmacyVerificationService.verifyDocument('doc-1', ADMIN_ID, true, 'ok'))
      .rejects.toThrow('Document not found');
  });

  test('records the verification decision with the admin id and notes', async () => {
    await pharmacyVerificationService.verifyDocument('doc-1', ADMIN_ID, true, 'Looks legitimate');
    expect(pharmacyDocumentRepo.updateVerification).toHaveBeenCalledWith('doc-1', true, ADMIN_ID, 'Looks legitimate');
  });
});

// ============================================================================
// approvePharmacy — the core status-consistency path
// ============================================================================

describe('approvePharmacy', () => {
  test('refuses to approve when no documents have been submitted', async () => {
    pharmacyDocumentRepo.findByPharmacyId = jest.fn().mockResolvedValue([]);
    await expect(pharmacyVerificationService.approvePharmacy(PHARMACY_ID, ADMIN_ID, 'ok'))
      .rejects.toThrow('Cannot approve');
    expect(pharmacyProfileRepo.updateVerificationStatus).not.toHaveBeenCalled();
  });

  test('refuses to approve when any submitted document is still unverified', async () => {
    pharmacyDocumentRepo.findByPharmacyId = jest.fn().mockResolvedValue([
      { id: 'd1', isVerified: true }, { id: 'd2', isVerified: false },
    ]);
    await expect(pharmacyVerificationService.approvePharmacy(PHARMACY_ID, ADMIN_ID, 'ok'))
      .rejects.toThrow('All documents must be verified before approval');
    expect(pharmacyProfileRepo.updateVerificationStatus).not.toHaveBeenCalled();
  });

  test('approves atomically: PharmacyProfile.verificationStatus and the active PharmacyVerificationRequest.status both move to "approved"', async () => {
    pharmacyDocumentRepo.findByPharmacyId = jest.fn().mockResolvedValue([{ id: 'd1', isVerified: true }]);
    pharmacyVerificationRepo.findByPharmacyId = jest.fn().mockResolvedValue([
      { id: REQUEST_ID, status: 'in_progress' },
    ]);

    await pharmacyVerificationService.approvePharmacy(PHARMACY_ID, ADMIN_ID, 'All good');

    expect(pharmacyProfileRepo.updateVerificationStatus).toHaveBeenCalledWith(PHARMACY_ID, 'approved');
    expect(pharmacyVerificationRepo.updateStatus).toHaveBeenCalledWith(REQUEST_ID, 'approved', ADMIN_ID, 'All good');
  });

  test('still updates PharmacyProfile.verificationStatus even if no active verification request is found (no desync left dangling on the request side beyond what exists)', async () => {
    pharmacyDocumentRepo.findByPharmacyId = jest.fn().mockResolvedValue([{ id: 'd1', isVerified: true }]);
    pharmacyVerificationRepo.findByPharmacyId = jest.fn().mockResolvedValue([
      { id: REQUEST_ID, status: 'approved' }, // already terminal — _findActiveRequest finds nothing
    ]);

    await pharmacyVerificationService.approvePharmacy(PHARMACY_ID, ADMIN_ID, 'ok');

    expect(pharmacyProfileRepo.updateVerificationStatus).toHaveBeenCalledWith(PHARMACY_ID, 'approved');
    expect(pharmacyVerificationRepo.updateStatus).not.toHaveBeenCalled();
  });

  test('auto-creates a vendor profile + wallet on approval so the pharmacy can list in the shop', async () => {
    pharmacyDocumentRepo.findByPharmacyId = jest.fn().mockResolvedValue([{ id: 'd1', isVerified: true }]);
    const vendorRepo = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((d) => d), save: jest.fn(async (d) => ({ id: 'vendor-1', ...d })) };
    const walletRepo = { create: jest.fn((d) => d), save: jest.fn().mockResolvedValue(undefined) };
    AppDataSource.getRepository = jest.fn((name) => (name === 'VendorProfile' ? vendorRepo : name === 'VendorWallet' ? walletRepo : { findOne: jest.fn() }));

    await pharmacyVerificationService.approvePharmacy(PHARMACY_ID, ADMIN_ID, 'ok');

    expect(vendorRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', isHybridPharmacy: true, verificationStatus: 'approved', pharmacyProfileId: PHARMACY_ID,
    }));
    expect(walletRepo.save).toHaveBeenCalledWith(expect.objectContaining({ vendorId: 'vendor-1', availableBalanceNgn: 0 }));
  });

  test('does not create a duplicate vendor profile if one already exists', async () => {
    pharmacyDocumentRepo.findByPharmacyId = jest.fn().mockResolvedValue([{ id: 'd1', isVerified: true }]);
    const vendorRepo = { findOne: jest.fn().mockResolvedValue({ id: 'existing-vendor' }), create: jest.fn(), save: jest.fn() };
    AppDataSource.getRepository = jest.fn((name) => (name === 'VendorProfile' ? vendorRepo : { findOne: jest.fn(), create: jest.fn(), save: jest.fn() }));

    await pharmacyVerificationService.approvePharmacy(PHARMACY_ID, ADMIN_ID, 'ok');
    expect(vendorRepo.save).not.toHaveBeenCalled();
  });

  test('approval still succeeds (core status change unaffected) even when vendor-profile auto-creation throws', async () => {
    pharmacyDocumentRepo.findByPharmacyId = jest.fn().mockResolvedValue([{ id: 'd1', isVerified: true }]);
    AppDataSource.getRepository = jest.fn(() => { throw new Error('db unavailable'); });

    await expect(pharmacyVerificationService.approvePharmacy(PHARMACY_ID, ADMIN_ID, 'ok')).resolves.toEqual({
      success: true, message: 'Pharmacy approved successfully',
    });
    expect(pharmacyProfileRepo.updateVerificationStatus).toHaveBeenCalledWith(PHARMACY_ID, 'approved');
  });
});

// ============================================================================
// rejectPharmacy
// ============================================================================

describe('rejectPharmacy', () => {
  test('moves both PharmacyProfile.verificationStatus and the active request to "rejected"', async () => {
    await pharmacyVerificationService.rejectPharmacy(PHARMACY_ID, ADMIN_ID, 'Invalid license');

    expect(pharmacyProfileRepo.updateVerificationStatus).toHaveBeenCalledWith(PHARMACY_ID, 'rejected');
    expect(pharmacyVerificationRepo.updateStatus).toHaveBeenCalledWith(REQUEST_ID, 'rejected', ADMIN_ID, 'Invalid license');
  });

  test('does not touch the verification request when none is active', async () => {
    pharmacyVerificationRepo.findByPharmacyId = jest.fn().mockResolvedValue([{ id: REQUEST_ID, status: 'rejected' }]);
    await pharmacyVerificationService.rejectPharmacy(PHARMACY_ID, ADMIN_ID, 'Invalid license');
    expect(pharmacyVerificationRepo.updateStatus).not.toHaveBeenCalled();
  });
});

// ============================================================================
// requestMoreDocuments — the profile/request status pair uses DIFFERENT
// string values by design; pin that down explicitly.
// ============================================================================

describe('requestMoreDocuments', () => {
  test('sets PharmacyProfile.verificationStatus to "documents_required" (NOT "requires_changes")', async () => {
    await pharmacyVerificationService.requestMoreDocuments(PHARMACY_ID, ADMIN_ID, ['license']);
    expect(pharmacyProfileRepo.updateVerificationStatus).toHaveBeenCalledWith(PHARMACY_ID, 'documents_required');
  });

  test('sets PharmacyVerificationRequest.status to "requires_changes" with a message listing all required documents', async () => {
    await pharmacyVerificationService.requestMoreDocuments(PHARMACY_ID, ADMIN_ID, ['license', 'government_id']);
    expect(pharmacyVerificationRepo.updateStatus).toHaveBeenCalledWith(
      REQUEST_ID, 'requires_changes', ADMIN_ID, 'Additional documents required: license, government_id'
    );
  });
});

// ============================================================================
// _findActiveRequest matching semantics, exercised indirectly through a
// second approve/reject call landing on a request already sent back for
// requires_changes (the scenario the in-source comment calls out).
// ============================================================================

describe('active-request matching across the documents_required -> re-approval lifecycle', () => {
  test('a request previously sent to requires_changes is still the one approved next', async () => {
    pharmacyDocumentRepo.findByPharmacyId = jest.fn().mockResolvedValue([{ id: 'd1', isVerified: true }]);
    pharmacyVerificationRepo.findByPharmacyId = jest.fn().mockResolvedValue([
      { id: REQUEST_ID, status: 'requires_changes' },
    ]);

    await pharmacyVerificationService.approvePharmacy(PHARMACY_ID, ADMIN_ID, 'Documents fixed, approved');

    expect(pharmacyVerificationRepo.updateStatus).toHaveBeenCalledWith(REQUEST_ID, 'approved', ADMIN_ID, 'Documents fixed, approved');
  });
});
