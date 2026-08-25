/* eslint-env jest */
// Unit tests for the patient profileController — mostly thin delegation to
// patientService, so the focus here is the request-shaping (what gets passed
// to the service) and the error-to-status-code mapping, using plain mock
// req/res/next objects (no supertest/HTTP layer in this repo).
//
// createProfile / updateProfile / manageProfileOptions are exported as
// [validatorMiddleware, handler] arrays; these tests call the handler
// (array[1]) directly and don't exercise the shared Joi validators, which
// are out of this feature's scope.

jest.mock('../../services/patientService');
jest.mock('../../../../shared/services/profileOptionsService');

const patientService = require('../../services/patientService');
const profileOptionsService = require('../../../../shared/services/profileOptionsService');

const profileController = require('../profileController');

const USER_ID = 'uuuu0000-0000-0000-0000-000000000001';
const PROFILE_ID = 'pppp0000-0000-0000-0000-000000000002';

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
// createProfile
// ============================================================================

describe('createProfile', () => {
    const createHandler = profileController.createProfile[1];

    test('builds the service payload from req.body and req.user.sub, and returns 201 with a trimmed profile shape', async () => {
        const savedProfile = {
            id: PROFILE_ID,
            fullName: 'Jane Doe',
            email: 'jane@example.com',
            profileType: 'self',
            createdAt: '2026-01-01',
            extraInternalField: 'should not leak',
        };
        patientService.createPatientProfile = jest.fn().mockResolvedValue(savedProfile);

        const req = {
            body: { fullName: 'Jane Doe', email: 'jane@example.com', gender: 'female' },
            user: { sub: USER_ID },
        };
        const res = makeRes();

        await createHandler(req, res, jest.fn());

        expect(patientService.createPatientProfile).toHaveBeenCalledWith({
            fullName: 'Jane Doe',
            email: 'jane@example.com',
            gender: 'female',
            user: { id: USER_ID },
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Patient profile created successfully',
            profile: {
                id: PROFILE_ID,
                fullName: 'Jane Doe',
                email: 'jane@example.com',
                profileType: 'self',
                createdAt: '2026-01-01',
            },
        });
    });

    test('omits "user" from the payload when the caller has no authenticated id', async () => {
        patientService.createPatientProfile = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        const req = { body: { fullName: 'Jane' }, user: {} };
        const res = makeRes();

        await createHandler(req, res, jest.fn());

        expect(patientService.createPatientProfile).toHaveBeenCalledWith(
            expect.objectContaining({ user: undefined })
        );
    });

    test.each([
        ['Email already in use'],
        ['Patient profile already exists for this user'],
    ])('maps "%s" to a 400', async (message) => {
        patientService.createPatientProfile = jest.fn().mockRejectedValue(new Error(message));
        const req = { body: {}, user: { sub: USER_ID } };
        const res = makeRes();

        await createHandler(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, message });
    });

    test('maps "User not found" to a 404', async () => {
        patientService.createPatientProfile = jest.fn().mockRejectedValue(new Error('User not found'));
        const req = { body: {}, user: { sub: USER_ID } };
        const res = makeRes();

        await createHandler(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('forwards unrecognized errors to next()', async () => {
        const err = new Error('unexpected boom');
        patientService.createPatientProfile = jest.fn().mockRejectedValue(err);
        const req = { body: {}, user: { sub: USER_ID } };
        const res = makeRes();
        const next = jest.fn();

        await createHandler(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
        expect(res.status).not.toHaveBeenCalled();
    });
});

// ============================================================================
// getProfileById
// ============================================================================

describe('getProfileById', () => {
    test('returns the profile on success', async () => {
        patientService.getPatientProfileById = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        const req = { params: { id: PROFILE_ID } };
        const res = makeRes();

        await profileController.getProfileById(req, res, jest.fn());

        expect(patientService.getPatientProfileById).toHaveBeenCalledWith(PROFILE_ID);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Patient profile retrieved successfully',
            profile: { id: PROFILE_ID },
        });
    });

    test('maps "Patient profile not found" to a 404', async () => {
        patientService.getPatientProfileById = jest.fn().mockRejectedValue(new Error('Patient profile not found'));
        const req = { params: { id: PROFILE_ID } };
        const res = makeRes();

        await profileController.getProfileById(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('forwards unrecognized errors to next()', async () => {
        const err = new Error('db exploded');
        patientService.getPatientProfileById = jest.fn().mockRejectedValue(err);
        const req = { params: { id: PROFILE_ID } };
        const res = makeRes();
        const next = jest.fn();

        await profileController.getProfileById(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
    });
});

// ============================================================================
// getProfileByUserId
// ============================================================================

describe('getProfileByUserId', () => {
    test('returns whatever the service returns, including null', async () => {
        patientService.getPatientProfileByUserId = jest.fn().mockResolvedValue(null);
        const req = { params: { userId: USER_ID } };
        const res = makeRes();

        await profileController.getProfileByUserId(req, res, jest.fn());

        expect(patientService.getPatientProfileByUserId).toHaveBeenCalledWith(USER_ID);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Patient profile retrieved successfully',
            profile: null,
        });
    });

    test('forwards unrecognized errors to next()', async () => {
        const err = new Error('boom');
        patientService.getPatientProfileByUserId = jest.fn().mockRejectedValue(err);
        const req = { params: { userId: USER_ID } };
        const res = makeRes();
        const next = jest.fn();

        await profileController.getProfileByUserId(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
    });
});

// ============================================================================
// updateProfile
// ============================================================================

describe('updateProfile', () => {
    const updateHandler = profileController.updateProfile[1];

    test('delegates to the service with (id, body, req) and returns a trimmed profile shape', async () => {
        patientService.updatePatientProfile = jest.fn().mockResolvedValue({
            id: PROFILE_ID,
            fullName: 'New Name',
            email: 'x@example.com',
            profileType: 'self',
            updatedAt: '2026-01-02',
        });
        const req = { params: { id: PROFILE_ID }, body: { fullName: 'New Name' }, user: { sub: USER_ID } };
        const res = makeRes();

        await updateHandler(req, res, jest.fn());

        expect(patientService.updatePatientProfile).toHaveBeenCalledWith(PROFILE_ID, { fullName: 'New Name' }, req);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Patient profile updated successfully',
            profile: {
                id: PROFILE_ID,
                fullName: 'New Name',
                email: 'x@example.com',
                profileType: 'self',
                updatedAt: '2026-01-02',
            },
        });
    });

    test('maps "Patient profile not found" to a 404', async () => {
        patientService.updatePatientProfile = jest.fn().mockRejectedValue(new Error('Patient profile not found'));
        const req = { params: { id: PROFILE_ID }, body: {}, user: { sub: USER_ID } };
        const res = makeRes();

        await updateHandler(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('forwards unrecognized errors to next()', async () => {
        const err = new Error('boom');
        patientService.updatePatientProfile = jest.fn().mockRejectedValue(err);
        const req = { params: { id: PROFILE_ID }, body: {}, user: { sub: USER_ID } };
        const res = makeRes();
        const next = jest.fn();

        await updateHandler(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
    });
});

// ============================================================================
// deleteProfile
// ============================================================================

describe('deleteProfile', () => {
    test('deletes and returns a success message', async () => {
        patientService.deletePatientProfile = jest.fn().mockResolvedValue(undefined);
        const req = { params: { id: PROFILE_ID }, user: { sub: USER_ID } };
        const res = makeRes();

        await profileController.deleteProfile(req, res, jest.fn());

        expect(patientService.deletePatientProfile).toHaveBeenCalledWith(PROFILE_ID, req);
        expect(res.json).toHaveBeenCalledWith({ message: 'Patient profile deleted successfully' });
    });

    test('maps "Patient profile not found" to a 404', async () => {
        patientService.deletePatientProfile = jest.fn().mockRejectedValue(new Error('Patient profile not found'));
        const req = { params: { id: PROFILE_ID }, user: { sub: USER_ID } };
        const res = makeRes();

        await profileController.deleteProfile(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('forwards unrecognized errors to next()', async () => {
        const err = new Error('boom');
        patientService.deletePatientProfile = jest.fn().mockRejectedValue(err);
        const req = { params: { id: PROFILE_ID }, user: { sub: USER_ID } };
        const res = makeRes();
        const next = jest.fn();

        await profileController.deleteProfile(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
    });
});

// ============================================================================
// getProfileOptions / manageProfileOptions
// ============================================================================

describe('getProfileOptions', () => {
    test('returns 200 with the options payload', async () => {
        profileOptionsService.getProfileOptions = jest.fn().mockResolvedValue({ bloodGroups: ['A+'] });
        const req = {};
        const res = makeRes();

        await profileController.getProfileOptions(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ bloodGroups: ['A+'] });
    });

    test('forwards errors to next()', async () => {
        const err = new Error('boom');
        profileOptionsService.getProfileOptions = jest.fn().mockRejectedValue(err);
        const req = {};
        const res = makeRes();
        const next = jest.fn();

        await profileController.getProfileOptions(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
    });
});

describe('manageProfileOptions', () => {
    const manageHandler = profileController.manageProfileOptions[1];

    test('delegates operations to the service and returns 200 with results', async () => {
        profileOptionsService.manageProfileOptions = jest.fn().mockResolvedValue([{ ok: true }]);
        const req = { body: { operations: [{ action: 'add' }] } };
        const res = makeRes();

        await manageHandler(req, res, jest.fn());

        expect(profileOptionsService.manageProfileOptions).toHaveBeenCalledWith([{ action: 'add' }]);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ results: [{ ok: true }] });
    });

    test('forwards errors to next()', async () => {
        const err = new Error('boom');
        profileOptionsService.manageProfileOptions = jest.fn().mockRejectedValue(err);
        const req = { body: { operations: [] } };
        const res = makeRes();
        const next = jest.fn();

        await manageHandler(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
    });
});

// ============================================================================
// updateAuthInfo
// ============================================================================
// Light pass: the real-file-upload branch performs actual disk I/O
// (node:fs/node:crypto) and is intentionally left untested here, mirroring
// the same boundary already drawn for the doctor feature's identical
// updateAuthInfo logic (src/features/doctor/controllers/__tests__/profileController.test.js).

describe('updateAuthInfo', () => {
    test('requires at least one field (or a file) to update', async () => {
        patientService.updateAuthInfo = jest.fn();
        const req = { user: { sub: USER_ID }, body: {} };
        const res = makeRes();

        await profileController.updateAuthInfo(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(patientService.updateAuthInfo).not.toHaveBeenCalled();
    });

    test('updates when at least one field is provided and returns the shaped success response', async () => {
        patientService.updateAuthInfo = jest.fn().mockResolvedValue({ id: USER_ID, fullName: 'New Name' });
        const req = { user: { sub: USER_ID }, body: { fullName: 'New Name' } };
        const res = makeRes();

        await profileController.updateAuthInfo(req, res, jest.fn());

        expect(patientService.updateAuthInfo).toHaveBeenCalledWith(USER_ID, {
            fullName: 'New Name',
            profileImageUrl: undefined,
            bannerUrl: undefined,
        });
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { id: USER_ID, fullName: 'New Name' },
            message: 'Authentication information updated successfully',
        });
    });

    test('forwards unexpected errors to next()', async () => {
        const err = new Error('boom');
        patientService.updateAuthInfo = jest.fn().mockRejectedValue(err);
        const req = { user: { sub: USER_ID }, body: { fullName: 'New Name' } };
        const res = makeRes();
        const next = jest.fn();

        await profileController.updateAuthInfo(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
    });
});
