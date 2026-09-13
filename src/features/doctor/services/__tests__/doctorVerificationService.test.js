/* eslint-env jest */
// Unit tests for DoctorVerificationService.approveVerification / rejectVerification.
//
// These two methods are the only code paths allowed to set a doctor's
// verification outcome. Written after a production incident where
// users.status ('doctor_active') drifted out of sync with the real
// verification_requests.status (see reconcile_doctor_verification_status.js
// and the fix to scripts/repair_users.js on 2026-08-25). The tests below
// pin down the invariants that keep the two in sync going forward:
//   - approve is transactional: request status, status history, and
//     users.status all move together or not at all.
//   - reject intentionally leaves users.status untouched (a rejected doctor
//     keeps whatever status they had — usually pending_doctor_verification —
//     and can resubmit).
//   - only PENDING/IN_PROGRESS/MANUAL_REVIEW/API_VERIFICATION requests can be
//     rejected.

jest.mock('../../../../config/database');
jest.mock('../../repositories/verificationRequestRepository');
jest.mock('../../repositories/verificationStatusHistoryRepository');
jest.mock('../../repositories/verificationReviewQueueRepository');
jest.mock('../../repositories/doctorProfileRepository');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('../../../payments/repositories/doctorWalletRepository');
jest.mock('../../../subscriptions/repositories/subscriptionRepository');
jest.mock('../../../payments/services/walletService');
jest.mock('../../../subscriptions/services/subscriptionCompatibilityService');
jest.mock('../../../../shared/services/email/emailHelpers');
jest.mock('../../../../shared/utils/notificationUtils');
jest.mock('../apiConnectorService');
jest.mock('../documentProcessingService');
jest.mock('../ninVerificationService');
jest.mock('../../../documents/middlewares/documentUploadMiddleware');

const AppDataSource = require('../../../../config/database');
const verificationRequestRepo = require('../../repositories/verificationRequestRepository');
const verificationStatusHistoryRepo = require('../../repositories/verificationStatusHistoryRepository');
const queueRepo = require('../../repositories/verificationReviewQueueRepository');
const doctorProfileRepo = require('../../repositories/doctorProfileRepository');
const userRepository = require('../../../auth/repositories/userRepository');
const { getNotificationSocket } = require('../../../../shared/utils/notificationUtils');

const doctorVerificationService = require('../doctorVerificationService');

const REQUEST_ID = 'aaaa0000-0000-0000-0000-000000000001';
const DOCTOR_ID  = 'bbbb0000-0000-0000-0000-000000000002';
const ADMIN_ID   = 'cccc0000-0000-0000-0000-000000000003';

function makeVerificationRequest(overrides = {}) {
  return {
    id: REQUEST_ID,
    doctorId: DOCTOR_ID,
    status: 'pending',
    countryCode: 'NG',
    tier: 'tier_2',
    confidenceScore: 80,
    licenseNumber: 'MDCN-12345',
    issuingAuthority: 'MDCN',
    ...overrides,
  };
}

// The three writes inside AppDataSource.transaction(async manager => {...})
// go through manager.getRepository(name).update/insert. This fake stands in
// for the TypeORM EntityManager so we can assert on exactly what each
// repository name received.
function makeFakeManager() {
  const repos = {
    VerificationRequest: { update: jest.fn().mockResolvedValue(undefined) },
    VerificationStatusHistory: { insert: jest.fn().mockResolvedValue(undefined) },
    User: { update: jest.fn().mockResolvedValue(undefined) },
  };
  return {
    getRepository: (name) => repos[name],
    __repos: repos,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  let lastManager;
  AppDataSource.transaction = jest.fn(async (cb) => {
    lastManager = makeFakeManager();
    await cb(lastManager);
    return lastManager;
  });
  AppDataSource.__getLastManager = () => lastManager;

  verificationRequestRepo.findById = jest.fn().mockResolvedValue(makeVerificationRequest());
  verificationRequestRepo.update = jest.fn().mockResolvedValue(undefined);
  verificationRequestRepo.repo = { find: jest.fn().mockResolvedValue([]) };

  verificationStatusHistoryRepo.logStatusChange = jest.fn().mockResolvedValue(undefined);
  queueRepo.markCompleted = jest.fn().mockResolvedValue(undefined);

  doctorProfileRepo.createProfileIfNotExists = jest.fn().mockResolvedValue(undefined);
  doctorProfileRepo.updateByUserId = jest.fn().mockResolvedValue(undefined);
  doctorProfileRepo.repo = { findOne: jest.fn().mockResolvedValue(null) };

  userRepository.findById = jest.fn().mockResolvedValue({ id: DOCTOR_ID, email: 'doctor@example.com' });

  getNotificationSocket.mockReturnValue({
    sendNotificationToUser: jest.fn().mockResolvedValue(undefined),
  });
});

// ============================================================================
// SUITE 1 - approveVerification: the transactional core
// ============================================================================

describe('approveVerification - transactional status update', () => {
  test('approves the request and activates the doctor in a single transaction', async () => {
    const result = await doctorVerificationService.approveVerification(REQUEST_ID, ADMIN_ID, 'Looks good');

    expect(AppDataSource.transaction).toHaveBeenCalledTimes(1);

    const manager = AppDataSource.__getLastManager();
    expect(manager.__repos.VerificationRequest.update).toHaveBeenCalledWith(
      REQUEST_ID,
      expect.objectContaining({ status: 'approved', updatedBy: ADMIN_ID, reviewNotes: 'Looks good' })
    );
    expect(manager.__repos.VerificationStatusHistory.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationRequestId: REQUEST_ID,
        fromStatus: 'pending',
        toStatus: 'approved',
        changedBy: ADMIN_ID,
      })
    );
    // This is the write that must never be skipped or desynced from the two
    // above — it's what the wallet gate, the doctor listing, and login all
    // actually check.
    expect(manager.__repos.User.update).toHaveBeenCalledWith(DOCTOR_ID, { status: 'doctor_active' });

    expect(result.verificationRequest.doctorId).toBe(DOCTOR_ID);
  });

  test('throws when verificationRequestId is missing', async () => {
    await expect(doctorVerificationService.approveVerification(null, ADMIN_ID)).rejects.toThrow(
      'Verification request ID is required'
    );
    expect(AppDataSource.transaction).not.toHaveBeenCalled();
  });

  test('throws when the verification request does not exist', async () => {
    verificationRequestRepo.findById = jest.fn().mockResolvedValue(null);

    await expect(doctorVerificationService.approveVerification(REQUEST_ID, ADMIN_ID)).rejects.toThrow(
      `Verification request not found with ID: ${REQUEST_ID}`
    );
    expect(AppDataSource.transaction).not.toHaveBeenCalled();
  });

  test('marks the automated-change flag when approved by the system', async () => {
    await doctorVerificationService.approveVerification(REQUEST_ID, 'system', 'Auto-approved');

    const manager = AppDataSource.__getLastManager();
    expect(manager.__repos.VerificationStatusHistory.insert).toHaveBeenCalledWith(
      expect.objectContaining({ automatedChange: true })
    );
  });

  test('doctor is activated even when the best-effort profile sync fails afterwards', async () => {
    // updateDoctorProfileVerificationStatus / syncVerifiedDataToProfile are
    // documented as non-fatal, self-healing steps — a doctor should never
    // fail to get activated because of a downstream profile-sync error.
    doctorProfileRepo.updateByUserId = jest.fn().mockRejectedValue(new Error('profile table unavailable'));

    await expect(
      doctorVerificationService.approveVerification(REQUEST_ID, ADMIN_ID)
    ).resolves.toBeDefined();

    const manager = AppDataSource.__getLastManager();
    expect(manager.__repos.User.update).toHaveBeenCalledWith(DOCTOR_ID, { status: 'doctor_active' });
  });

  test('doctor is activated even when removing the request from the review queue fails', async () => {
    // Regression guard: a transient failure in this bookkeeping step must not
    // make a successful approval look like a failure to the admin who
    // triggered it (the core status change has already committed by here).
    queueRepo.markCompleted = jest.fn().mockRejectedValue(new Error('queue table locked'));

    await expect(
      doctorVerificationService.approveVerification(REQUEST_ID, ADMIN_ID)
    ).resolves.toBeDefined();

    const manager = AppDataSource.__getLastManager();
    expect(manager.__repos.User.update).toHaveBeenCalledWith(DOCTOR_ID, { status: 'doctor_active' });
  });
});

// ============================================================================
// SUITE 2 - rejectVerification: must NOT touch users.status
// ============================================================================

describe('rejectVerification - leaves users.status untouched', () => {
  test('rejects a pending request without ever writing to the users table', async () => {
    const result = await doctorVerificationService.rejectVerification(
      REQUEST_ID,
      ADMIN_ID,
      'License could not be confirmed with MDCN'
    );

    expect(verificationRequestRepo.update).toHaveBeenCalledWith(
      REQUEST_ID,
      expect.objectContaining({ status: 'rejected', rejectionReason: 'License could not be confirmed with MDCN' })
    );
    expect(verificationStatusHistoryRepo.logStatusChange).toHaveBeenCalledWith(
      REQUEST_ID,
      'pending',
      'rejected',
      ADMIN_ID,
      'License could not be confirmed with MDCN',
      null,
      false
    );
    // The regression this whole suite exists to prevent: rejection must never
    // silently promote or otherwise touch the doctor's account status.
    expect(AppDataSource.transaction).not.toHaveBeenCalled();
    expect(result.doctorId).toBe(DOCTOR_ID);
  });

  test.each(['in_progress', 'manual_review', 'api_verification'])(
    'allows rejecting a request with status "%s"',
    async (status) => {
      verificationRequestRepo.findById = jest.fn().mockResolvedValue(makeVerificationRequest({ status }));

      await expect(
        doctorVerificationService.rejectVerification(REQUEST_ID, ADMIN_ID, 'Documents unreadable')
      ).resolves.toBeDefined();
    }
  );

  test.each(['approved', 'rejected', 'expired'])(
    'refuses to reject a request already in a terminal/non-reviewable status "%s"',
    async (status) => {
      verificationRequestRepo.findById = jest.fn().mockResolvedValue(makeVerificationRequest({ status }));

      await expect(
        doctorVerificationService.rejectVerification(REQUEST_ID, ADMIN_ID, 'Documents unreadable')
      ).rejects.toThrow(`Cannot reject verification with status: ${status}`);
      expect(verificationRequestRepo.update).not.toHaveBeenCalled();
    }
  );

  test('requires a non-empty rejection reason', async () => {
    await expect(doctorVerificationService.rejectVerification(REQUEST_ID, ADMIN_ID, '')).rejects.toThrow(
      'Rejection reason is required'
    );
    await expect(doctorVerificationService.rejectVerification(REQUEST_ID, ADMIN_ID, '   ')).rejects.toThrow(
      'Rejection reason is required'
    );
    expect(verificationRequestRepo.update).not.toHaveBeenCalled();
  });

  test('requires a verificationRequestId', async () => {
    await expect(doctorVerificationService.rejectVerification(null, ADMIN_ID, 'reason')).rejects.toThrow(
      'Verification request ID is required'
    );
  });

  test('throws when the verification request does not exist', async () => {
    verificationRequestRepo.findById = jest.fn().mockResolvedValue(null);

    await expect(
      doctorVerificationService.rejectVerification(REQUEST_ID, ADMIN_ID, 'reason')
    ).rejects.toThrow(`Verification request not found with ID: ${REQUEST_ID}`);
  });

  test('still returns successfully when the rejection notification fails to send', async () => {
    userRepository.findById = jest.fn().mockRejectedValue(new Error('notification service down'));

    await expect(
      doctorVerificationService.rejectVerification(REQUEST_ID, ADMIN_ID, 'Documents unreadable')
    ).resolves.toBeDefined();
  });
});
