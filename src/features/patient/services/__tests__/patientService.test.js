/* eslint-env jest */
// Unit tests for PatientService — patient profile CRUD, related-entity
// upsert logic, and the AI activity listener trigger fired after a
// successful update.

jest.mock('../../../../config/database');
jest.mock('../../repositories/patientProfileRepository');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('../patientActivityListener');

const patientProfileRepository = require('../../repositories/patientProfileRepository');
const userRepository = require('../../../auth/repositories/userRepository');
const patientActivityListener = require('../patientActivityListener');

const patientService = require('../patientService');

const USER_ID = 'uuuu0000-0000-0000-0000-000000000001';
const PROFILE_ID = 'pppp0000-0000-0000-0000-000000000002';

function repoStub() {
    return {
        save: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(undefined),
    };
}

beforeEach(() => {
    jest.clearAllMocks();

    // Automocking patientProfileRepository (a class instance) turns its
    // sub-repo properties (populated via AppDataSource.getRepository in the
    // constructor) into undefined, since config/database is also automocked.
    // Each test that touches a related entity needs a real stand-in object.
    patientProfileRepository.medicalConditionRepo = repoStub();
    patientProfileRepository.surgeryRepo = repoStub();
    patientProfileRepository.allergyRepo = repoStub();
    patientProfileRepository.familyHistoryRepo = repoStub();
    patientProfileRepository.medicationRepo = repoStub();
    patientProfileRepository.immunizationRepo = repoStub();
    patientProfileRepository.healthInsuranceRepo = repoStub();
    patientProfileRepository.disabilityRepo = repoStub();
    patientProfileRepository.consentRepo = repoStub();

    patientProfileRepository.findById = jest.fn().mockResolvedValue(null);
    patientProfileRepository.findByUserId = jest.fn().mockResolvedValue(null);
    patientProfileRepository.create = jest.fn().mockImplementation((data) => data);
    patientProfileRepository.save = jest.fn().mockImplementation((data) => Promise.resolve({ id: PROFILE_ID, ...data }));
    patientProfileRepository.update = jest.fn().mockResolvedValue(undefined);
    patientProfileRepository.delete = jest.fn().mockResolvedValue(undefined);

    userRepository.findById = jest.fn().mockResolvedValue({ id: USER_ID, email: 'patient@example.com' });
    userRepository.create = jest.fn();
    userRepository.save = jest.fn();
    userRepository.updateAuthInfo = jest.fn().mockResolvedValue(undefined);

    patientActivityListener.onPatientProfileUpdated = jest.fn().mockResolvedValue(undefined);
});

// ============================================================================
// createPatientProfile
// ============================================================================

describe('createPatientProfile', () => {
    test('creates a profile for an existing user referenced by data.user.id', async () => {
        const data = { user: { id: USER_ID }, fullName: 'Jane Doe', gender: 'female' };

        const result = await patientService.createPatientProfile(data);

        expect(patientProfileRepository.findByUserId).toHaveBeenCalledWith(USER_ID);
        expect(userRepository.findById).toHaveBeenCalledWith(USER_ID);
        expect(patientProfileRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ fullName: 'Jane Doe', gender: 'female', user: { id: USER_ID, email: 'patient@example.com' } })
        );
        expect(patientProfileRepository.save).toHaveBeenCalled();
        expect(result.id).toBe(PROFILE_ID);
    });

    test('throws when a profile already exists for the referenced user', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: 'existing-profile' });

        await expect(
            patientService.createPatientProfile({ user: { id: USER_ID }, fullName: 'Jane' })
        ).rejects.toThrow('Patient profile already exists for this user');

        expect(userRepository.findById).not.toHaveBeenCalled();
        expect(patientProfileRepository.create).not.toHaveBeenCalled();
    });

    test('throws "User not found" when data.user.id does not resolve to a real user', async () => {
        userRepository.findById = jest.fn().mockResolvedValue(null);

        await expect(
            patientService.createPatientProfile({ user: { id: USER_ID }, fullName: 'Jane' })
        ).rejects.toThrow('User not found');

        expect(patientProfileRepository.create).not.toHaveBeenCalled();
    });

    test('creates a brand-new user record when only an email is provided', async () => {
        const newUser = { email: 'new@example.com', fullName: 'New Patient' };
        const savedUser = { id: 'new-user-id', ...newUser };
        userRepository.create = jest.fn().mockReturnValue(newUser);
        userRepository.save = jest.fn().mockResolvedValue(savedUser);

        const result = await patientService.createPatientProfile({ email: 'new@example.com', fullName: 'New Patient' });

        expect(patientProfileRepository.findByUserId).not.toHaveBeenCalled();
        expect(userRepository.findById).not.toHaveBeenCalled();
        expect(userRepository.create).toHaveBeenCalledWith({ email: 'new@example.com', fullName: 'New Patient' });
        expect(userRepository.save).toHaveBeenCalledWith(newUser);
        expect(patientProfileRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ user: savedUser })
        );
        expect(result.id).toBe(PROFILE_ID);
    });

    test('throws when neither a user nor an email is provided', async () => {
        await expect(patientService.createPatientProfile({ fullName: 'No identifiers' })).rejects.toThrow(
            'User ID or email is required'
        );
        expect(patientProfileRepository.create).not.toHaveBeenCalled();
    });

    test('sanitizes empty-string fields to null before saving related entities', async () => {
        const data = {
            user: { id: USER_ID },
            fullName: 'Jane',
            medicalConditions: [{ name: 'Diabetes', notes: '' }],
        };

        const saved = await patientService.createPatientProfile(data);

        expect(patientProfileRepository.medicalConditionRepo.save).toHaveBeenCalledWith({
            name: 'Diabetes',
            notes: null,
            patientProfile: saved,
        });
    });

    test('saves each related-entity array under its own repository', async () => {
        const data = {
            user: { id: USER_ID },
            fullName: 'Jane',
            surgeries: [{ name: 'Appendectomy' }],
            allergies: [{ allergen: 'Peanuts' }],
            familyHistories: [{ medicalCondition: 'Hypertension' }],
            medications: [{ name: 'Metformin' }],
            immunizations: [{ vaccine: 'MMR' }],
        };

        await patientService.createPatientProfile(data);

        expect(patientProfileRepository.surgeryRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Appendectomy' })
        );
        expect(patientProfileRepository.allergyRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({ allergen: 'Peanuts' })
        );
        expect(patientProfileRepository.familyHistoryRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({ medicalCondition: 'Hypertension' })
        );
        expect(patientProfileRepository.medicationRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Metformin' })
        );
        expect(patientProfileRepository.immunizationRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({ vaccine: 'MMR' })
        );
    });

    test('saves healthInsurance, disability, and consent sub-records when provided', async () => {
        const data = {
            user: { id: USER_ID },
            fullName: 'Jane',
            healthInsurance: { provider: 'NHIS' },
            disability: { type: 'Visual' },
            consent: { dataSharing: true },
        };

        await patientService.createPatientProfile(data);

        expect(patientProfileRepository.healthInsuranceRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({ provider: 'NHIS' })
        );
        expect(patientProfileRepository.disabilityRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'Visual' })
        );
        expect(patientProfileRepository.consentRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({ dataSharing: true })
        );
    });

    test('does not touch sub-record repositories when nothing is provided for them', async () => {
        await patientService.createPatientProfile({ user: { id: USER_ID }, fullName: 'Jane' });

        expect(patientProfileRepository.healthInsuranceRepo.save).not.toHaveBeenCalled();
        expect(patientProfileRepository.disabilityRepo.save).not.toHaveBeenCalled();
        expect(patientProfileRepository.consentRepo.save).not.toHaveBeenCalled();
        expect(patientProfileRepository.medicalConditionRepo.save).not.toHaveBeenCalled();
    });
});

// ============================================================================
// getPatientProfileById / getPatientProfileByUserId
// ============================================================================

describe('getPatientProfileById', () => {
    test('returns the profile when found', async () => {
        patientProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        const result = await patientService.getPatientProfileById(PROFILE_ID);

        expect(result).toEqual({ id: PROFILE_ID });
    });

    test('throws "Patient profile not found" when missing', async () => {
        patientProfileRepository.findById = jest.fn().mockResolvedValue(null);

        await expect(patientService.getPatientProfileById(PROFILE_ID)).rejects.toThrow(
            'Patient profile not found'
        );
    });
});

describe('getPatientProfileByUserId', () => {
    test('passes through whatever the repository returns, including null', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue(null);

        const result = await patientService.getPatientProfileByUserId(USER_ID);

        expect(result).toBeNull();
        expect(patientProfileRepository.findByUserId).toHaveBeenCalledWith(USER_ID);
    });

    test('returns the found profile', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        const result = await patientService.getPatientProfileByUserId(USER_ID);

        expect(result).toEqual({ id: PROFILE_ID });
    });
});

// ============================================================================
// updatePatientProfile
// ============================================================================

describe('updatePatientProfile', () => {
    function makeReq() {
        return { user: { sub: USER_ID } };
    }

    test('throws "Patient profile not found" when the caller has no profile of their own', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue(null);
        patientProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        await expect(
            patientService.updatePatientProfile(PROFILE_ID, { fullName: 'X' }, makeReq())
        ).rejects.toThrow('Patient profile not found');
        expect(patientProfileRepository.update).not.toHaveBeenCalled();
    });

    test('throws "Patient profile not found" when the target profile does not exist', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.findById = jest.fn().mockResolvedValue(null);

        await expect(
            patientService.updatePatientProfile(PROFILE_ID, { fullName: 'X' }, makeReq())
        ).rejects.toThrow('Patient profile not found');
    });

    test('throws "Patient profile not found" when the caller does not own the target profile', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: 'some-other-profile' });
        patientProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        await expect(
            patientService.updatePatientProfile(PROFILE_ID, { fullName: 'X' }, makeReq())
        ).rejects.toThrow('Patient profile not found');
    });

    test('strips undefined fields before writing and returns the update result', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.update = jest.fn().mockResolvedValue({ id: PROFILE_ID, fullName: 'Updated' });

        const result = await patientService.updatePatientProfile(
            PROFILE_ID,
            { fullName: 'Updated', gender: undefined },
            makeReq()
        );

        const [, writtenData] = patientProfileRepository.update.mock.calls[0];
        expect(writtenData).not.toHaveProperty('gender');
        expect(writtenData.fullName).toBe('Updated');
        expect(result).toEqual({ id: PROFILE_ID, fullName: 'Updated' });
    });

    test('updates an existing related-entity record found by id', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.medicalConditionRepo.findOne = jest.fn().mockResolvedValue({ id: 'mc-1' });

        await patientService.updatePatientProfile(
            PROFILE_ID,
            { medicalConditions: [{ id: 'mc-1', name: 'Asthma' }] },
            makeReq()
        );

        expect(patientProfileRepository.medicalConditionRepo.update).toHaveBeenCalledWith('mc-1', {
            id: 'mc-1',
            name: 'Asthma',
        });
        expect(patientProfileRepository.medicalConditionRepo.save).not.toHaveBeenCalled();
    });

    test('falls back to the unique business key when no id is given for a related entity', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.allergyRepo.findOne = jest.fn().mockResolvedValue({ id: 'al-1' });

        await patientService.updatePatientProfile(
            PROFILE_ID,
            { allergies: [{ allergen: 'Peanuts', severity: 'high' }] },
            makeReq()
        );

        expect(patientProfileRepository.allergyRepo.findOne).toHaveBeenCalledWith({
            where: { patientProfile: { id: PROFILE_ID }, allergen: 'Peanuts' },
        });
        expect(patientProfileRepository.allergyRepo.update).toHaveBeenCalledWith('al-1', {
            allergen: 'Peanuts',
            severity: 'high',
        });
    });

    test('creates a new related-entity record when no existing match is found', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        // findOne already defaults to resolving null via repoStub()

        await patientService.updatePatientProfile(
            PROFILE_ID,
            { medications: [{ name: 'Ibuprofen' }] },
            makeReq()
        );

        expect(patientProfileRepository.medicationRepo.save).toHaveBeenCalledWith({
            name: 'Ibuprofen',
            patientProfile: { id: PROFILE_ID },
        });
        expect(patientProfileRepository.medicationRepo.update).not.toHaveBeenCalled();
    });

    test('updates an existing healthInsurance/disability/consent record when one already exists', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.healthInsuranceRepo.findOne = jest.fn().mockResolvedValue({ id: 'hi-1' });
        patientProfileRepository.disabilityRepo.findOne = jest.fn().mockResolvedValue({ id: 'd-1' });
        patientProfileRepository.consentRepo.findOne = jest.fn().mockResolvedValue({ id: 'c-1' });

        await patientService.updatePatientProfile(
            PROFILE_ID,
            {
                healthInsurance: { provider: 'AXA' },
                disability: { type: 'Hearing' },
                consent: { dataSharing: false },
            },
            makeReq()
        );

        expect(patientProfileRepository.healthInsuranceRepo.update).toHaveBeenCalledWith('hi-1', { provider: 'AXA' });
        expect(patientProfileRepository.disabilityRepo.update).toHaveBeenCalledWith('d-1', { type: 'Hearing' });
        expect(patientProfileRepository.consentRepo.update).toHaveBeenCalledWith('c-1', { dataSharing: false });
    });

    test('creates healthInsurance/disability/consent records when none already exist', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        await patientService.updatePatientProfile(
            PROFILE_ID,
            { healthInsurance: { provider: 'AXA' } },
            makeReq()
        );

        expect(patientProfileRepository.healthInsuranceRepo.save).toHaveBeenCalledWith({
            provider: 'AXA',
            patientProfile: { id: PROFILE_ID },
        });
    });

    test('triggers the AI activity listener with freshly fetched data after a successful update', async () => {
        const ownerProfile = { id: PROFILE_ID, version: 'owner-check' };
        const freshProfile = { id: PROFILE_ID, version: 'post-update-fresh' };
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue(ownerProfile);
        patientProfileRepository.findById = jest
            .fn()
            .mockResolvedValueOnce(ownerProfile) // ownership check
            .mockResolvedValueOnce(freshProfile); // re-fetch for the listener
        patientProfileRepository.update = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        await patientService.updatePatientProfile(PROFILE_ID, { fullName: 'X' }, makeReq());

        expect(patientActivityListener.onPatientProfileUpdated).toHaveBeenCalledWith(PROFILE_ID, freshProfile);
    });

    test('does not trigger the AI activity listener when the update reports no change', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.update = jest.fn().mockResolvedValue(null);

        const result = await patientService.updatePatientProfile(PROFILE_ID, { fullName: 'X' }, makeReq());

        expect(patientActivityListener.onPatientProfileUpdated).not.toHaveBeenCalled();
        expect(result).toBeNull();
        // findById should only have been called once, for the ownership check
        expect(patientProfileRepository.findById).toHaveBeenCalledTimes(1);
    });
});

// ============================================================================
// deletePatientProfile
// ============================================================================

describe('deletePatientProfile', () => {
    function makeReq() {
        return { user: { sub: USER_ID } };
    }

    test('deletes the profile when the caller owns it', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        await patientService.deletePatientProfile(PROFILE_ID, makeReq());

        expect(patientProfileRepository.delete).toHaveBeenCalledWith(PROFILE_ID);
    });

    test('throws "Patient profile not found" when the caller does not own the profile', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: 'other' });
        patientProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        await expect(patientService.deletePatientProfile(PROFILE_ID, makeReq())).rejects.toThrow(
            'Patient profile not found'
        );
        expect(patientProfileRepository.delete).not.toHaveBeenCalled();
    });

    test('throws "Patient profile not found" when the target profile does not exist', async () => {
        patientProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        patientProfileRepository.findById = jest.fn().mockResolvedValue(null);

        await expect(patientService.deletePatientProfile(PROFILE_ID, makeReq())).rejects.toThrow(
            'Patient profile not found'
        );
        expect(patientProfileRepository.delete).not.toHaveBeenCalled();
    });
});

// ============================================================================
// updateAuthInfo
// ============================================================================

describe('updateAuthInfo', () => {
    test('writes the auth-info fields and returns a shaped, whitelisted user object', async () => {
        userRepository.updateAuthInfo = jest.fn().mockResolvedValue(undefined);
        userRepository.findById = jest.fn().mockResolvedValue({
            id: USER_ID,
            fullName: 'Jane Doe',
            email: 'jane@example.com',
            role: 'patient',
            status: 'active',
            profileImageUrl: 'http://img',
            bannerUrl: 'http://banner',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-02',
            passwordHash: 'should-not-leak',
        });

        const result = await patientService.updateAuthInfo(USER_ID, {
            fullName: 'Jane Doe',
            profileImageUrl: 'http://img',
            bannerUrl: 'http://banner',
        });

        expect(userRepository.updateAuthInfo).toHaveBeenCalledWith(USER_ID, {
            fullName: 'Jane Doe',
            profileImageUrl: 'http://img',
            bannerUrl: 'http://banner',
        });
        expect(result).toEqual({
            id: USER_ID,
            fullName: 'Jane Doe',
            email: 'jane@example.com',
            role: 'patient',
            status: 'active',
            profileImageUrl: 'http://img',
            bannerUrl: 'http://banner',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-02',
        });
        expect(result).not.toHaveProperty('passwordHash');
    });
});
