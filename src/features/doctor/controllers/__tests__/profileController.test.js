/* eslint-env jest */
// Light-pass unit tests for profileController - it is thin delegation to
// doctorService for almost everything, so the only controller-owned logic
// worth pinning down is: (a) request validation (missing required
// query/body fields), and (b) the err.message -> HTTP status code mapping in
// each catch block, which varies handler-to-handler and is easy to get wrong
// on a refactor. doctorService itself already has full coverage in
// doctorService.test.js, so business-rule correctness is not re-tested here.
//
// createProfile and updateProfile are exported as [validatorMiddleware,
// handler] arrays; these tests call the handler (index 1) directly and don't
// exercise the validator middleware.

jest.mock('../../services/doctorService');

const doctorService = require('../../services/doctorService');
const profileController = require('../profileController');

function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const PROFILE_ID = 'bbbb0000-0000-0000-0000-000000000002';

beforeEach(() => {
    jest.clearAllMocks();
});

describe('createProfile', () => {
    const handler = profileController.createProfile[1];

    test('returns 201 with a trimmed profile payload on success', async () => {
        doctorService.createDoctorProfile = jest.fn().mockResolvedValue({
            id: PROFILE_ID,
            fullName: 'Dr X',
            email: 'x@example.com',
            createdAt: 'created',
            extraFieldNotExposed: 'secret',
        });
        const req = { body: { fullName: 'Dr X', email: 'x@example.com' }, user: { sub: USER_ID } };
        const res = makeRes();
        const next = jest.fn();

        await handler(req, res, next);

        expect(doctorService.createDoctorProfile).toHaveBeenCalledWith({
            fullName: 'Dr X',
            email: 'x@example.com',
            user: { id: USER_ID },
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Doctor profile created successfully',
            profile: { id: PROFILE_ID, fullName: 'Dr X', email: 'x@example.com', createdAt: 'created' },
        });
    });

    test.each([
        ['Email already in use'],
        ['Doctor profile already exists for this user'],
    ])('maps "%s" to 400', async (message) => {
        doctorService.createDoctorProfile = jest.fn().mockRejectedValue(new Error(message));
        const req = { body: {}, user: { sub: USER_ID } };
        const res = makeRes();
        const next = jest.fn();

        await handler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, message });
        expect(next).not.toHaveBeenCalled();
    });

    test('maps "User not found" to 404', async () => {
        doctorService.createDoctorProfile = jest.fn().mockRejectedValue(new Error('User not found'));
        const req = { body: {}, user: { sub: USER_ID } };
        const res = makeRes();
        const next = jest.fn();

        await handler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('forwards an unrecognized error to next()', async () => {
        const err = new Error('something else entirely');
        doctorService.createDoctorProfile = jest.fn().mockRejectedValue(err);
        const req = { body: {}, user: { sub: USER_ID } };
        const res = makeRes();
        const next = jest.fn();

        await handler(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe('getProfileById', () => {
    test('returns the profile on success', async () => {
        doctorService.getDoctorProfileById = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        const req = { params: { id: PROFILE_ID } };
        const res = makeRes();

        await profileController.getProfileById(req, res, jest.fn());

        expect(res.json).toHaveBeenCalledWith({
            message: 'Doctor profile retrieved successfully',
            profile: { id: PROFILE_ID },
        });
    });

    test('maps "Doctor profile not found" to 404', async () => {
        doctorService.getDoctorProfileById = jest.fn().mockRejectedValue(new Error('Doctor profile not found'));
        const req = { params: { id: PROFILE_ID } };
        const res = makeRes();

        await profileController.getProfileById(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe('getProfileByUserId', () => {
    test('maps "Doctor profile not found for this user" to 404', async () => {
        doctorService.getDoctorProfileByUserId = jest
            .fn()
            .mockRejectedValue(new Error('Doctor profile not found for this user'));
        const req = { params: { userId: USER_ID } };
        const res = makeRes();

        await profileController.getProfileByUserId(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe('updateProfile', () => {
    const handler = profileController.updateProfile[1];

    test('returns the updated profile on success', async () => {
        doctorService.updateDoctorProfile = jest.fn().mockResolvedValue({
            id: PROFILE_ID,
            fullName: 'Updated',
            email: 'u@example.com',
            updatedAt: 'now',
        });
        const req = { params: { id: PROFILE_ID }, body: { fullName: 'Updated' }, user: { sub: USER_ID } };
        const res = makeRes();

        await handler(req, res, jest.fn());

        expect(doctorService.updateDoctorProfile).toHaveBeenCalledWith(PROFILE_ID, { fullName: 'Updated' }, req);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Doctor profile updated successfully',
            profile: { id: PROFILE_ID, fullName: 'Updated', email: 'u@example.com', updatedAt: 'now' },
        });
    });

    test('maps "Doctor profile not found" to 404', async () => {
        doctorService.updateDoctorProfile = jest.fn().mockRejectedValue(new Error('Doctor profile not found'));
        const req = { params: { id: PROFILE_ID }, body: {}, user: { sub: USER_ID } };
        const res = makeRes();

        await handler(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe('deleteProfile', () => {
    test('confirms deletion on success', async () => {
        doctorService.deleteDoctorProfile = jest.fn().mockResolvedValue(undefined);
        const req = { params: { id: PROFILE_ID }, user: { sub: USER_ID } };
        const res = makeRes();

        await profileController.deleteProfile(req, res, jest.fn());

        expect(res.json).toHaveBeenCalledWith({ message: 'Doctor profile deleted successfully' });
    });

    test('maps "Doctor profile not found" to 404', async () => {
        doctorService.deleteDoctorProfile = jest.fn().mockRejectedValue(new Error('Doctor profile not found'));
        const req = { params: { id: PROFILE_ID }, user: { sub: USER_ID } };
        const res = makeRes();

        await profileController.deleteProfile(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe('getAllDoctors / getAllDoctorsWithCompleteProfile / getAllVerifiedDoctors', () => {
    test('getAllDoctors defaults page/limit and shapes the response', async () => {
        doctorService.getAllDoctors = jest.fn().mockResolvedValue({ data: [{ id: 'd1' }], meta: { total: 1 } });
        const req = { query: {} };
        const res = makeRes();

        await profileController.getAllDoctors(req, res, jest.fn());

        expect(doctorService.getAllDoctors).toHaveBeenCalledWith({ page: 1, limit: 10 });
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: [{ id: 'd1' }],
            meta: { total: 1 },
            message: 'Doctors retrieved successfully',
        });
    });

    test('getAllDoctors parses page/limit from the query string', async () => {
        doctorService.getAllDoctors = jest.fn().mockResolvedValue({ data: [], meta: {} });
        const req = { query: { page: '3', limit: '20' } };

        await profileController.getAllDoctors(req, makeRes(), jest.fn());

        expect(doctorService.getAllDoctors).toHaveBeenCalledWith({ page: 3, limit: 20 });
    });

    test('getAllDoctorsWithCompleteProfile delegates and shapes its response', async () => {
        doctorService.getAllDoctorsWithCompleteProfile = jest.fn().mockResolvedValue({ data: [], meta: {} });
        await profileController.getAllDoctorsWithCompleteProfile({ query: {} }, makeRes(), jest.fn());
        expect(doctorService.getAllDoctorsWithCompleteProfile).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    test('getAllVerifiedDoctors delegates and shapes its response', async () => {
        doctorService.getAllVerifiedDoctors = jest.fn().mockResolvedValue({ data: [], meta: {} });
        await profileController.getAllVerifiedDoctors({ query: {} }, makeRes(), jest.fn());
        expect(doctorService.getAllVerifiedDoctors).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });
});

describe('getDoctorsByOnlineStatus', () => {
    test('requires the isOnline query parameter', async () => {
        const req = { query: {} };
        const res = makeRes();

        await profileController.getDoctorsByOnlineStatus(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(doctorService.getDoctorsByOnlineStatus).not.toHaveBeenCalled();
    });

    test('parses the "true"/"false" string into a real boolean', async () => {
        doctorService.getDoctorsByOnlineStatus = jest.fn().mockResolvedValue([{ id: 'd1' }]);
        const req = { query: { isOnline: 'true' } };

        await profileController.getDoctorsByOnlineStatus(req, makeRes(), jest.fn());

        expect(doctorService.getDoctorsByOnlineStatus).toHaveBeenCalledWith(true);
    });

    test('treats anything other than the literal string "true" as false', async () => {
        doctorService.getDoctorsByOnlineStatus = jest.fn().mockResolvedValue([]);
        const req = { query: { isOnline: 'yes' } };

        await profileController.getDoctorsByOnlineStatus(req, makeRes(), jest.fn());

        expect(doctorService.getDoctorsByOnlineStatus).toHaveBeenCalledWith(false);
    });
});

describe('searchDoctors', () => {
    test('requires a q or search query parameter', async () => {
        const req = { query: {} };
        const res = makeRes();

        await profileController.searchDoctors(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(doctorService.searchDoctors).not.toHaveBeenCalled();
    });

    test('accepts "search" as a fallback alias for "q"', async () => {
        doctorService.searchDoctors = jest.fn().mockResolvedValue([]);
        const req = { query: { search: 'cardio' } };

        await profileController.searchDoctors(req, makeRes(), jest.fn());

        expect(doctorService.searchDoctors).toHaveBeenCalledWith('cardio');
    });

    test('maps the short-query error to 400', async () => {
        doctorService.searchDoctors = jest.fn().mockRejectedValue(
            new Error('Search query must be at least 3 characters long')
        );
        const req = { query: { q: 'ab' } };
        const res = makeRes();

        await profileController.searchDoctors(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

describe('updateOnlineStatus', () => {
    test('requires userId (from the token) and isOnline in the body', async () => {
        const req = { user: {}, body: {} };
        const res = makeRes();

        await profileController.updateOnlineStatus(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(doctorService.updateOnlineStatus).not.toHaveBeenCalled();
    });

    test.each([
        ['User not found'],
        ['User must be a doctor'],
        ['Unauthorized: Only the doctor or an admin can update online status'],
    ])('maps "%s" to 403', async (message) => {
        doctorService.updateOnlineStatus = jest.fn().mockRejectedValue(new Error(message));
        const req = { user: { sub: USER_ID, role: 'doctor' }, body: { isOnline: true } };
        const res = makeRes();

        await profileController.updateOnlineStatus(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('returns the updated status on success', async () => {
        doctorService.updateOnlineStatus = jest.fn().mockResolvedValue({ id: USER_ID, isOnline: true });
        const req = { user: { sub: USER_ID, role: 'doctor' }, body: { isOnline: true } };
        const res = makeRes();

        await profileController.updateOnlineStatus(req, res, jest.fn());

        expect(doctorService.updateOnlineStatus).toHaveBeenCalledWith(USER_ID, true, req.user);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { id: USER_ID, isOnline: true },
            message: 'Online status updated successfully',
        });
    });
});

describe('getOnlineStatus', () => {
    test('requires a userId param', async () => {
        const req = { params: {} };
        const res = makeRes();

        await profileController.getOnlineStatus(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test.each([['User not found'], ['User must be a doctor']])('maps "%s" to 400', async (message) => {
        doctorService.getDoctorOnlineStatus = jest.fn().mockRejectedValue(new Error(message));
        const req = { params: { userId: USER_ID } };
        const res = makeRes();

        await profileController.getOnlineStatus(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

describe('updateAuthInfo', () => {
    test('requires at least one field (or a file) to update', async () => {
        const req = { user: { sub: USER_ID }, body: {} };
        const res = makeRes();

        await profileController.updateAuthInfo(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(doctorService.updateAuthInfo).not.toHaveBeenCalled();
    });

    test('updates when at least one field is provided', async () => {
        doctorService.updateAuthInfo = jest.fn().mockResolvedValue({ id: USER_ID, fullName: 'New Name' });
        const req = { user: { sub: USER_ID }, body: { fullName: 'New Name' } };
        const res = makeRes();

        await profileController.updateAuthInfo(req, res, jest.fn());

        expect(doctorService.updateAuthInfo).toHaveBeenCalledWith(USER_ID, {
            fullName: 'New Name',
            profileImageUrl: undefined,
            bannerUrl: undefined,
            departmentSpecialty: undefined,
        });
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { id: USER_ID, fullName: 'New Name' },
            message: 'Authentication information updated successfully',
        });
    });
});

describe('addRating', () => {
    test('returns the rating result on success', async () => {
        doctorService.addUserRating = jest.fn().mockResolvedValue({ rating: 5 });
        const req = { user: { sub: USER_ID }, body: { userId: 'other-doctor', rating: 5, message: 'Great' } };
        const res = makeRes();

        await profileController.addRating(req, res, jest.fn());

        expect(doctorService.addUserRating).toHaveBeenCalledWith(USER_ID, 'other-doctor', 5, 'Great');
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { rating: 5 },
            message: 'Rating added successfully',
        });
    });

    test('on failure responds 400 with a bare {error} body (no "success" key, unlike other handlers)', async () => {
        doctorService.addUserRating = jest.fn().mockRejectedValue(new Error("user's can't rate themselves"));
        const req = { user: { sub: USER_ID }, body: { userId: USER_ID, rating: 5 } };
        const res = makeRes();

        await profileController.addRating(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "user's can't rate themselves" });
    });
});

describe('getRatings', () => {
    test('returns ratings on success', async () => {
        doctorService.getUserRatings = jest.fn().mockResolvedValue([{ rating: 4 }]);
        const req = { params: { userId: USER_ID } };
        const res = makeRes();

        await profileController.getRatings(req, res, jest.fn());

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: [{ rating: 4 }],
            message: 'Ratings retrieved successfully',
        });
    });

    test('on failure responds 400 with {success:false, message}', async () => {
        doctorService.getUserRatings = jest.fn().mockRejectedValue(new Error('boom'));
        const req = { params: { userId: USER_ID } };
        const res = makeRes();

        await profileController.getRatings(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'boom' });
    });
});
