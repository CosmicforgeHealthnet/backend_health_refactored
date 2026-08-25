/* eslint-env jest */
// Light, targeted unit tests for DoctorVerificationController.
//
// The service layer (doctorVerificationService.js) already has full coverage
// in doctorVerificationService.test.js, so this file deliberately does NOT
// re-test business rules. It covers only controller-owned concerns:
// request validation, ownership checks, and HTTP status-code mapping - with
// particular attention to the submission-gate check at submitVerification()
// (around line 53), which this session's investigation found to contain a
// dead branch:
//
//   if (!['pending_doctor_verification', 'locked'].includes(req.user.status))
//
// req.user.status comes from the JWT, and authService.js's login normalizes
// it before signing: `status: user.status === 'locked' ? 'active' : user.status`
// (see src/features/auth/services/authService.js ~line 130). That means
// req.user.status can never actually equal 'locked' at request time - the
// 'locked' branch of this .includes() check is unreachable in production.
// A genuinely locked doctor's token instead carries status: 'active', which
// this gate rejects anyway (since 'active' isn't 'pending_doctor_verification'
// either) - just via the generic "already verified or not eligible" message
// rather than any locked-specific handling. Low severity (the doctor is still
// correctly rejected, just with a slightly less specific reason), so this is
// documented here rather than "fixed" - there is no live bug to fix, only
// dead code worth knowing about next time this gate is touched.

// doctorVerificationController requires doctorVerificationService.js, which
// pulls in a long transitive chain (walletService -> paymentService ->
// whatsapp notifications -> redis config, documentUploadMiddleware -> a
// config with required-at-require-time fields, etc). jest.mock() must load
// the *real* module once to shape the automock, so that whole chain executes
// unless each risky link is mocked directly - mirrors the mock list in
// doctorVerificationService.test.js, which hit and solved the same problem.
jest.mock('../../services/doctorVerificationService.js');
jest.mock('../../repositories/verificationRequestRepository');
jest.mock('../../repositories/verificationDocumentRepository');
jest.mock('../../repositories/verificationStatusHistoryRepository.js');
jest.mock('../../repositories/verificationReviewQueueRepository');
jest.mock('../../repositories/doctorProfileRepository');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('../../../payments/repositories/doctorWalletRepository');
jest.mock('../../../subscriptions/repositories/subscriptionRepository');
jest.mock('../../../payments/services/walletService');
jest.mock('../../../subscriptions/services/subscriptionCompatibilityService');
jest.mock('../../../../shared/services/email/emailHelpers');
jest.mock('../../../../shared/utils/notificationUtils');
jest.mock('../../services/apiConnectorService');
jest.mock('../../services/documentProcessingService');
jest.mock('../../services/ninVerificationService');
jest.mock('../../../documents/middlewares/documentUploadMiddleware');
jest.mock('../../../../config/database');
// NOT mocked: verificationConfig - documentUploadMiddleware (loaded for real
// once, to shape its own automock) reads config.FILE_LIMITS.MAX_FILE_SIZE at
// require time, so shadowing this module with a partial fake object here
// would break that unrelated require and fail the whole suite. The real
// config's DOCUMENT_REQUIREMENTS.tier_2 is
// ['medical_license', 'medical_degree', 'government_id'] - used as-is below.

const doctorVerificationService = require('../../services/doctorVerificationService.js');
const verificationRequestRepo = require('../../repositories/verificationRequestRepository');
const verificationDocumentRepo = require('../../repositories/verificationDocumentRepository');
const verificationStatusHistoryRepo = require('../../repositories/verificationStatusHistoryRepository.js');

const controller = require('../doctorVerificationController');

const DOCTOR_ID = 'aaaa0000-0000-0000-0000-000000000001';
const REQUEST_ID = 'bbbb0000-0000-0000-0000-000000000002';

function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function makeReq(overrides = {}) {
    return {
        body: { licenseNumber: 'MDCN-1', countryCode: 'ng' },
        user: { sub: DOCTOR_ID, role: 'doctor', status: 'pending_doctor_verification' },
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    verificationDocumentRepo.findByVerificationRequestId = jest.fn().mockResolvedValue([]);
    verificationRequestRepo.update = jest.fn().mockResolvedValue({});
    verificationRequestRepo.findById = jest.fn().mockResolvedValue(null);
    verificationStatusHistoryRepo.logStatusChange = jest.fn().mockResolvedValue(undefined);
});

// ============================================================================
// submitVerification - request validation and the submission gate
// ============================================================================

describe('submitVerification - request validation', () => {
    test('rejects when licenseNumber is missing', async () => {
        const req = makeReq({ body: { countryCode: 'ng' } });
        const res = makeRes();

        await controller.submitVerification(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'License number and country code are required' });
        expect(doctorVerificationService.submitVerificationRequest).not.toHaveBeenCalled();
    });

    test('rejects when countryCode is missing', async () => {
        const req = makeReq({ body: { licenseNumber: 'MDCN-1' } });
        const res = makeRes();

        await controller.submitVerification(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects a non-doctor role with 403, before checking status', async () => {
        const req = makeReq({ user: { sub: DOCTOR_ID, role: 'patient', status: 'pending_doctor_verification' } });
        const res = makeRes();

        await controller.submitVerification(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Only doctors can submit verification requests' });
    });

    test('allows submission when status is pending_doctor_verification', async () => {
        doctorVerificationService.submitVerificationRequest = jest.fn().mockResolvedValue({
            id: REQUEST_ID,
            tier: 'tier_1',
            status: 'in_progress',
            method: 'api',
            submittedAt: 'now',
            expiresAt: 'later',
        });
        const req = makeReq();
        const res = makeRes();

        await controller.submitVerification(req, res, jest.fn());

        expect(doctorVerificationService.submitVerificationRequest).toHaveBeenCalledWith(
            DOCTOR_ID,
            expect.objectContaining({ licenseNumber: 'MDCN-1', countryCode: 'NG' }),
            DOCTOR_ID
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('DEAD BRANCH: a token claiming status "locked" would be allowed through, but authService never issues one', async () => {
        // Directly proves the 'locked' arm of the .includes() check is live
        // code (it does affect behavior if reached) - the reason it's dead is
        // external to this file (JWT minting always maps locked -> active).
        doctorVerificationService.submitVerificationRequest = jest.fn().mockResolvedValue({
            id: REQUEST_ID,
            tier: 'tier_1',
            status: 'in_progress',
            method: 'api',
        });
        const req = makeReq({ user: { sub: DOCTOR_ID, role: 'doctor', status: 'locked' } });
        const res = makeRes();

        await controller.submitVerification(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('a real locked doctor (token status normalized to "active") is rejected via the generic ineligibility message, not a locked-specific one', async () => {
        const req = makeReq({ user: { sub: DOCTOR_ID, role: 'doctor', status: 'active' } });
        const res = makeRes();

        await controller.submitVerification(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Doctor account is already verified or not eligible for verification submission',
        });
    });

    test('rejects an already-verified doctor (status doctor_active)', async () => {
        const req = makeReq({ user: { sub: DOCTOR_ID, role: 'doctor', status: 'doctor_active' } });
        const res = makeRes();

        await controller.submitVerification(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(doctorVerificationService.submitVerificationRequest).not.toHaveBeenCalled();
    });
});

describe('submitVerification - tier routing after a successful submission', () => {
    test('tier_1 responds 201 with an "automated" processing type and skips the document check entirely', async () => {
        doctorVerificationService.submitVerificationRequest = jest.fn().mockResolvedValue({
            id: REQUEST_ID,
            tier: 'tier_1',
            status: 'in_progress',
            method: 'api',
            submittedAt: 'now',
            expiresAt: 'later',
        });
        const req = makeReq();
        const res = makeRes();

        await controller.submitVerification(req, res, jest.fn());

        expect(verificationDocumentRepo.findByVerificationRequestId).not.toHaveBeenCalled();
        const [[payload]] = res.json.mock.calls;
        expect(payload.processingType).toBe('automated');
    });

    test('tier_2 with missing required documents moves the request to pending_documents', async () => {
        doctorVerificationService.submitVerificationRequest = jest.fn().mockResolvedValue({
            id: REQUEST_ID,
            tier: 'tier_2',
            status: 'in_progress',
            method: 'manual',
            submittedAt: 'now',
            expiresAt: 'later',
        });
        verificationDocumentRepo.findByVerificationRequestId = jest.fn().mockResolvedValue([]);
        const req = makeReq();
        const res = makeRes();

        await controller.submitVerification(req, res, jest.fn());

        expect(verificationRequestRepo.update).toHaveBeenCalledWith(REQUEST_ID, { status: 'pending_documents' });
        const [[payload]] = res.json.mock.calls;
        expect(payload.verificationRequest.status).toBe('pending_documents');
        expect(payload.processingType).toBe('hybrid');
    });

    test('tier_2 with all required documents present proceeds straight to manual review', async () => {
        doctorVerificationService.submitVerificationRequest = jest.fn().mockResolvedValue({
            id: REQUEST_ID,
            tier: 'tier_2',
            status: 'in_progress',
            method: 'manual',
            submittedAt: 'now',
            expiresAt: 'later',
        });
        // Real config's tier_2 requirement list (see file header note above).
        verificationDocumentRepo.findByVerificationRequestId = jest.fn().mockResolvedValue([
            { documentType: 'medical_license' },
            { documentType: 'medical_degree' },
            { documentType: 'government_id' },
        ]);
        const req = makeReq();
        const res = makeRes();

        await controller.submitVerification(req, res, jest.fn());

        expect(verificationRequestRepo.update).not.toHaveBeenCalled();
        const [[payload]] = res.json.mock.calls;
        expect(payload.verificationRequest.status).toBe('in_progress');
        expect(payload.estimatedTime).toBe('1-3 days');
    });
});

describe('submitVerification - error mapping', () => {
    test('maps "Doctor already has an active verification request" to 409 with an error code', async () => {
        doctorVerificationService.submitVerificationRequest = jest
            .fn()
            .mockRejectedValue(new Error('Doctor already has an active verification request'));
        const req = makeReq();
        const res = makeRes();

        await controller.submitVerification(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ errorCode: 'ACTIVE_VERIFICATION_EXISTS' })
        );
    });

    test('maps a "Country not supported" message to 400 with COUNTRY_NOT_SUPPORTED', async () => {
        doctorVerificationService.submitVerificationRequest = jest
            .fn()
            .mockRejectedValue(new Error('Country not supported: XX'));
        const req = makeReq();
        const res = makeRes();

        await controller.submitVerification(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'COUNTRY_NOT_SUPPORTED' }));
    });

    test('falls back to a generic 400 for an unrecognized error message', async () => {
        doctorVerificationService.submitVerificationRequest = jest
            .fn()
            .mockRejectedValue(new Error('something unexpected'));
        const req = makeReq();
        const res = makeRes();

        await controller.submitVerification(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'something unexpected', errorCode: 'GENERIC_ERROR' });
    });
});

// ============================================================================
// updateVerificationInfo - ownership + editable-status checks
// ============================================================================

describe('updateVerificationInfo - ownership and status checks', () => {
    test('returns 404 when the verification request does not exist', async () => {
        verificationRequestRepo.findById = jest.fn().mockResolvedValue(null);
        const req = { params: { id: REQUEST_ID }, body: {}, user: { sub: DOCTOR_ID } };
        const res = makeRes();

        await controller.updateVerificationInfo(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 404 when the request belongs to a different doctor (does not leak "belongs to someone else")', async () => {
        verificationRequestRepo.findById = jest.fn().mockResolvedValue({ id: REQUEST_ID, doctorId: 'someone-else', status: 'pending' });
        const req = { params: { id: REQUEST_ID }, body: {}, user: { sub: DOCTOR_ID } };
        const res = makeRes();

        await controller.updateVerificationInfo(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Verification request not found' });
    });

    test.each(['approved', 'expired'])('refuses to edit a request in a non-editable status "%s"', async (status) => {
        verificationRequestRepo.findById = jest.fn().mockResolvedValue({ id: REQUEST_ID, doctorId: DOCTOR_ID, status });
        const req = { params: { id: REQUEST_ID }, body: { licenseNumber: 'NEW' }, user: { sub: DOCTOR_ID } };
        const res = makeRes();

        await controller.updateVerificationInfo(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Cannot edit verification information in current status', currentStatus: status })
        );
    });

    test.each(['pending', 'in_progress', 'rejected'])('allows editing a request in status "%s"', async (status) => {
        verificationRequestRepo.findById = jest.fn().mockResolvedValue({ id: REQUEST_ID, doctorId: DOCTOR_ID, status });
        verificationRequestRepo.update = jest.fn().mockResolvedValue({ id: REQUEST_ID, licenseNumber: 'NEW', status });
        const req = { params: { id: REQUEST_ID }, body: { licenseNumber: 'new-license' }, user: { sub: DOCTOR_ID } };
        const res = makeRes();

        await controller.updateVerificationInfo(req, res, jest.fn());

        expect(verificationRequestRepo.update).toHaveBeenCalledWith(
            REQUEST_ID,
            expect.objectContaining({ licenseNumber: 'new-license', updatedBy: DOCTOR_ID })
        );
        expect(res.status).not.toHaveBeenCalledWith(400);
        expect(res.status).not.toHaveBeenCalledWith(404);
    });

    test('logs the edit as a status-history entry with the same from/to status', async () => {
        verificationRequestRepo.findById = jest.fn().mockResolvedValue({ id: REQUEST_ID, doctorId: DOCTOR_ID, status: 'pending' });
        verificationRequestRepo.update = jest.fn().mockResolvedValue({ id: REQUEST_ID, status: 'pending' });
        const req = { params: { id: REQUEST_ID }, body: { licenseNumber: 'new-license' }, user: { sub: DOCTOR_ID } };

        await controller.updateVerificationInfo(req, makeRes(), jest.fn());

        expect(verificationStatusHistoryRepo.logStatusChange).toHaveBeenCalledWith(
            REQUEST_ID,
            'pending',
            'pending',
            DOCTOR_ID,
            'Doctor updated verification information',
            expect.any(Object),
            false
        );
    });
});
