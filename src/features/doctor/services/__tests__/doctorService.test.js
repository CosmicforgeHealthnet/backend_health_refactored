/* eslint-env jest */
// Unit tests for DoctorService — the core business logic behind doctor
// listing/search, profile CRUD, online-status toggling, and ratings.
//
// Mirrors the house style established in doctorVerificationService.test.js
// and paymentAuth.test.js: automock every repository/service dependency
// (they're singleton instances, so automocking "just works"), assign
// per-test mock implementations in beforeEach, and assert on the real
// business-rule outcomes (what got written where, with what values; which
// error is thrown and when) rather than "does it not crash."

jest.mock('../../../../config/database');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('../../repositories/doctorProfileRepository');
jest.mock('../../../../shared/utils/cache');
jest.mock('../../../search/services/searchService');

const AppDataSource = require('../../../../config/database');
const userRepository = require('../../../auth/repositories/userRepository');
const doctorProfileRepository = require('../../repositories/doctorProfileRepository');
const cache = require('../../../../shared/utils/cache');
const searchService = require('../../../search/services/searchService');

const DoctorProfile = require('../../entities/DoctorProfile');
const ProfessionalLicense = require('../../entities/ProfessionalLicense');
const ProfessionalCertificate = require('../../entities/ProfessionalCertificate');
const ClinicalPractice = require('../../entities/ClinicalPractice');
const DigitalHealthTools = require('../../entities/DigitalHealthTools');
const DoctorWallet = require('../../entities/DoctorWallet');

const doctorService = require('../doctorService');

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const PROFILE_ID = 'bbbb0000-0000-0000-0000-000000000002';
const ADMIN_ID = 'cccc0000-0000-0000-0000-000000000003';

// Fake TypeORM EntityManager for AppDataSource.transaction(async manager => {...})
// in createDoctorProfile. Keyed by the actual EntitySchema object reference
// (that's what manager.getRepository(EntityClass) is called with here, unlike
// doctorVerificationService which uses string entity names).
function makeFakeManager() {
    const repos = new Map();
    const makeRepo = () => ({
        save: jest.fn().mockImplementation(async (data) => ({ id: PROFILE_ID, ...data })),
    });
    return {
        getRepository: (entity) => {
            if (!repos.has(entity)) repos.set(entity, makeRepo());
            return repos.get(entity);
        },
        __repoFor: (entity) => repos.get(entity),
    };
}

beforeEach(() => {
    jest.clearAllMocks();

    let lastManager;
    AppDataSource.transaction = jest.fn(async (cb) => {
        lastManager = makeFakeManager();
        return await cb(lastManager);
    });
    AppDataSource.__getLastManager = () => lastManager;

    doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue(null);
    doctorProfileRepository.findById = jest.fn().mockResolvedValue(null);
    doctorProfileRepository.update = jest.fn().mockResolvedValue({ id: PROFILE_ID, updated: true });
    doctorProfileRepository.delete = jest.fn().mockResolvedValue(undefined);
    doctorProfileRepository.professionalLicenseRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined),
    };
    doctorProfileRepository.professionalCertificateRepo = {
        delete: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined),
    };
    doctorProfileRepository.clinicalPracticeRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined),
    };
    doctorProfileRepository.digitalHealthToolsRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined),
    };
    doctorProfileRepository.walletRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined),
    };

    userRepository.findById = jest.fn().mockResolvedValue({ id: USER_ID, email: 'doc@example.com' });
    userRepository.create = jest.fn().mockImplementation((d) => d);
    userRepository.save = jest.fn().mockImplementation(async (d) => ({ id: USER_ID, ...d }));
    userRepository.findAllDoctors = jest.fn().mockResolvedValue({ doctors: [], total: 0 });
    userRepository.findAllCompleteProfileDoctors = jest.fn().mockResolvedValue({ doctors: [], total: 0 });
    userRepository.findVerifiedDoctors = jest.fn().mockResolvedValue({ doctors: [], total: 0 });
    userRepository.findADoctor = jest.fn().mockResolvedValue({ id: USER_ID });
    userRepository.findDoctorsByOnlineStatus = jest.fn().mockResolvedValue([]);
    userRepository.searchDoctors = jest.fn().mockResolvedValue([]);
    userRepository.updateAuthInfo = jest.fn().mockResolvedValue(undefined);
    userRepository.updateOnlineStatus = jest.fn().mockResolvedValue(undefined);
    userRepository.getOnlineStatus = jest.fn().mockResolvedValue({ id: USER_ID, isOnline: true });
    userRepository.isDoctorVerified = jest.fn().mockResolvedValue(true);
    userRepository.addUserRating = jest.fn().mockResolvedValue({ rating: 5 });
    userRepository.getUserRatings = jest.fn().mockResolvedValue([{ rating: 5 }]);

    // cache: default to a passthrough that just runs the fetcher, so tests
    // exercise the real fetch logic while still letting us assert on the
    // cache key / ttl that was used.
    cache.getOrSet = jest.fn(async (key, fetchFn) => await fetchFn());
    cache.del = jest.fn().mockResolvedValue(undefined);
    cache.invalidatePattern = jest.fn().mockResolvedValue(undefined);
});

// ============================================================================
// createDoctorProfile
// ============================================================================

describe('createDoctorProfile', () => {
    test('rejects when a profile already exists for the given user', async () => {
        doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        await expect(
            doctorService.createDoctorProfile({ user: { id: USER_ID }, fullName: 'Dr X' })
        ).rejects.toThrow('Doctor profile already exists for this user');
        expect(AppDataSource.transaction).not.toHaveBeenCalled();
    });

    test('throws when data.user is given but the user does not exist', async () => {
        userRepository.findById = jest.fn().mockResolvedValue(null);

        await expect(
            doctorService.createDoctorProfile({ user: { id: USER_ID } })
        ).rejects.toThrow('User not found');
    });

    test('creates a new user record when only an email is provided', async () => {
        await doctorService.createDoctorProfile({ email: 'new@example.com', fullName: 'Dr New' });

        expect(userRepository.create).toHaveBeenCalledWith({ email: 'new@example.com', fullName: 'Dr New' });
        expect(userRepository.save).toHaveBeenCalled();
    });

    test('throws when neither a user id nor an email is provided', async () => {
        await expect(doctorService.createDoctorProfile({ fullName: 'No identity' })).rejects.toThrow(
            'User ID or email is required'
        );
    });

    test('saves the profile and every sub-record inside the same transaction', async () => {
        const data = {
            user: { id: USER_ID },
            fullName: 'Dr X',
            professionalLicense: { medicalLicenseNumber: 'MDCN-1' },
            professionalCertificate: [{ name: 'Cert A' }, { name: 'Cert B' }],
            clinicalPractice: { hospitalName: 'General' },
            digitalHealthTools: { toolName: 'EMR' },
            wallet: { balance: 0 },
        };

        const result = await doctorService.createDoctorProfile(data);

        expect(AppDataSource.transaction).toHaveBeenCalledTimes(1);
        const manager = AppDataSource.__getLastManager();

        expect(manager.__repoFor(DoctorProfile).save).toHaveBeenCalledWith(
            expect.objectContaining({ fullName: 'Dr X' })
        );
        expect(manager.__repoFor(ProfessionalLicense).save).toHaveBeenCalledWith(
            expect.objectContaining({ medicalLicenseNumber: 'MDCN-1', doctorProfile: expect.objectContaining({ id: PROFILE_ID }) })
        );
        // Certificates are an array - every element must be saved individually.
        expect(manager.__repoFor(ProfessionalCertificate).save).toHaveBeenCalledTimes(2);
        expect(manager.__repoFor(ProfessionalCertificate).save).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ name: 'Cert A' })
        );
        expect(manager.__repoFor(ClinicalPractice).save).toHaveBeenCalledWith(
            expect.objectContaining({ hospitalName: 'General' })
        );
        expect(manager.__repoFor(DigitalHealthTools).save).toHaveBeenCalledWith(
            expect.objectContaining({ toolName: 'EMR' })
        );
        expect(manager.__repoFor(DoctorWallet).save).toHaveBeenCalledWith(
            expect.objectContaining({ balance: 0 })
        );

        expect(result.id).toBe(PROFILE_ID);
    });

    test('skips optional sub-record saves entirely when they are not provided', async () => {
        await doctorService.createDoctorProfile({ user: { id: USER_ID }, fullName: 'Dr Minimal' });

        const manager = AppDataSource.__getLastManager();
        expect(manager.__repoFor(ProfessionalLicense)).toBeUndefined();
        expect(manager.__repoFor(ProfessionalCertificate)).toBeUndefined();
        expect(manager.__repoFor(ClinicalPractice)).toBeUndefined();
        expect(manager.__repoFor(DigitalHealthTools)).toBeUndefined();
        expect(manager.__repoFor(DoctorWallet)).toBeUndefined();
    });
});

// ============================================================================
// getDoctorProfileById / getDoctorProfileByUserId
// ============================================================================

describe('getDoctorProfileById', () => {
    test('returns the profile when found', async () => {
        doctorProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        await expect(doctorService.getDoctorProfileById(PROFILE_ID)).resolves.toEqual({ id: PROFILE_ID });
    });

    test('throws when not found', async () => {
        doctorProfileRepository.findById = jest.fn().mockResolvedValue(null);
        await expect(doctorService.getDoctorProfileById(PROFILE_ID)).rejects.toThrow('Doctor profile not found');
    });
});

describe('getDoctorProfileByUserId', () => {
    test('returns the profile when found', async () => {
        doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        await expect(doctorService.getDoctorProfileByUserId(USER_ID)).resolves.toEqual({ id: PROFILE_ID });
    });

    test('throws when not found', async () => {
        doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue(null);
        await expect(doctorService.getDoctorProfileByUserId(USER_ID)).rejects.toThrow(
            'Doctor profile not found for this user'
        );
    });
});

// ============================================================================
// updateDoctorProfile - ownership check + sanitization + sub-record upserts
// ============================================================================

describe('updateDoctorProfile', () => {
    function req() {
        return { user: { sub: USER_ID } };
    }

    test('refuses to update when the requester does not own the profile', async () => {
        doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: 'other-profile' });
        doctorProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        await expect(
            doctorService.updateDoctorProfile(PROFILE_ID, {}, req())
        ).rejects.toThrow('Doctor profile not found');
        expect(doctorProfileRepository.update).not.toHaveBeenCalled();
    });

    test('refuses to update when the target profile does not exist', async () => {
        doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        doctorProfileRepository.findById = jest.fn().mockResolvedValue(null);

        await expect(doctorService.updateDoctorProfile(PROFILE_ID, {}, req())).rejects.toThrow(
            'Doctor profile not found'
        );
    });

    test('strips undefined top-level fields before persisting', async () => {
        doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID, user: { id: USER_ID } });
        doctorProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        await doctorService.updateDoctorProfile(PROFILE_ID, { fullName: 'New Name' }, req());

        expect(doctorProfileRepository.update).toHaveBeenCalledWith(PROFILE_ID, { fullName: 'New Name' });
    });

    test('updates an existing professional license in place, sanitizing "undefined"/"null"/"" sentinels', async () => {
        doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID, user: { id: USER_ID } });
        doctorProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        doctorProfileRepository.professionalLicenseRepo.findOne = jest.fn().mockResolvedValue({ id: 'lic-1' });

        await doctorService.updateDoctorProfile(
            PROFILE_ID,
            {
                professionalLicense: {
                    medicalLicenseNumber: 'MDCN-99',
                    subspecialty: 'undefined',
                    licenseDocument: 'null',
                    licenseAuthority: '',
                },
            },
            req()
        );

        expect(doctorProfileRepository.professionalLicenseRepo.update).toHaveBeenCalledWith('lic-1', {
            medicalLicenseNumber: 'MDCN-99',
            subspecialty: undefined,
            licenseDocument: undefined,
            licenseAuthority: undefined,
        });
        expect(doctorProfileRepository.professionalLicenseRepo.save).not.toHaveBeenCalled();
    });

    test('creates a new license with placeholder fallbacks when required fields are missing', async () => {
        doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID, user: { id: USER_ID } });
        doctorProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        doctorProfileRepository.professionalLicenseRepo.findOne = jest.fn().mockResolvedValue(null);

        await doctorService.updateDoctorProfile(
            PROFILE_ID,
            { professionalLicense: {} },
            req()
        );

        expect(doctorProfileRepository.professionalLicenseRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({
                countryOfLicense: 'Not Specified',
                medicalLicenseNumber: 'Not Specified',
                licenseAuthority: 'Not Specified',
                medicalInstitution: 'Not Specified',
                doctorProfile: { id: PROFILE_ID },
            })
        );
    });

    test('replaces all certificates: deletes existing then saves each new one', async () => {
        doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID, user: { id: USER_ID } });
        doctorProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        await doctorService.updateDoctorProfile(
            PROFILE_ID,
            { professionalCertificate: [{ name: 'A' }, { name: 'B' }] },
            req()
        );

        expect(doctorProfileRepository.professionalCertificateRepo.delete).toHaveBeenCalledWith({
            doctorProfile: { id: PROFILE_ID },
        });
        expect(doctorProfileRepository.professionalCertificateRepo.save).toHaveBeenCalledTimes(2);
    });

    test('updates existing clinical practice / digital health tools / wallet in place when present', async () => {
        doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID, user: { id: USER_ID } });
        doctorProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        doctorProfileRepository.clinicalPracticeRepo.findOne = jest.fn().mockResolvedValue({ id: 'cp-1' });
        doctorProfileRepository.digitalHealthToolsRepo.findOne = jest.fn().mockResolvedValue({ id: 'dht-1' });
        doctorProfileRepository.walletRepo.findOne = jest.fn().mockResolvedValue({ id: 'wallet-1' });

        await doctorService.updateDoctorProfile(
            PROFILE_ID,
            {
                clinicalPractice: { hospitalName: 'X' },
                digitalHealthTools: { toolName: 'Y' },
                wallet: { balance: 100 },
            },
            req()
        );

        expect(doctorProfileRepository.clinicalPracticeRepo.update).toHaveBeenCalledWith('cp-1', { hospitalName: 'X' });
        expect(doctorProfileRepository.digitalHealthToolsRepo.update).toHaveBeenCalledWith('dht-1', { toolName: 'Y' });
        expect(doctorProfileRepository.walletRepo.update).toHaveBeenCalledWith('wallet-1', { balance: 100 });
    });

    test('invalidates the doctor list cache and both doctor detail cache entries', async () => {
        doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID, user: { id: USER_ID } });
        doctorProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        await doctorService.updateDoctorProfile(PROFILE_ID, { fullName: 'Name' }, req());

        expect(cache.invalidatePattern).toHaveBeenCalledWith('doctors:*');
        expect(cache.del).toHaveBeenCalledWith(`doctor:${USER_ID}`);
        expect(cache.del).toHaveBeenCalledWith(`doctor:${PROFILE_ID}`);
    });
});

// ============================================================================
// deleteDoctorProfile
// ============================================================================

describe('deleteDoctorProfile', () => {
    test('deletes when the requester owns the profile', async () => {
        doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: PROFILE_ID });
        doctorProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        await doctorService.deleteDoctorProfile(PROFILE_ID, { user: { sub: USER_ID } });

        expect(doctorProfileRepository.delete).toHaveBeenCalledWith(PROFILE_ID);
    });

    test('refuses to delete a profile the requester does not own', async () => {
        doctorProfileRepository.findByUserId = jest.fn().mockResolvedValue({ id: 'other' });
        doctorProfileRepository.findById = jest.fn().mockResolvedValue({ id: PROFILE_ID });

        await expect(
            doctorService.deleteDoctorProfile(PROFILE_ID, { user: { sub: USER_ID } })
        ).rejects.toThrow('Doctor profile not found');
        expect(doctorProfileRepository.delete).not.toHaveBeenCalled();
    });
});

// ============================================================================
// Doctor listing / search - cache key + pagination meta
// ============================================================================

describe('getAllDoctors / getAllDoctorsWithCompleteProfile / getAllVerifiedDoctors', () => {
    test('getAllDoctors computes pagination meta and uses a page/limit cache key', async () => {
        userRepository.findAllDoctors = jest.fn().mockResolvedValue({ doctors: [{ id: 'd1' }], total: 25 });

        const result = await doctorService.getAllDoctors({ page: 2, limit: 10 });

        expect(cache.getOrSet).toHaveBeenCalledWith('doctors:all:page:2:limit:10', expect.any(Function), 300);
        expect(userRepository.findAllDoctors).toHaveBeenCalledWith({ skip: 10, take: 10 });
        expect(result).toEqual({
            data: [{ id: 'd1' }],
            meta: { total: 25, page: 2, limit: 10, totalPages: 3 },
        });
    });

    test('getAllDoctors defaults to page 1 / limit 10 when not provided', async () => {
        await doctorService.getAllDoctors();
        expect(userRepository.findAllDoctors).toHaveBeenCalledWith({ skip: 0, take: 10 });
    });

    test('getAllDoctorsWithCompleteProfile uses its own cache namespace', async () => {
        userRepository.findAllCompleteProfileDoctors = jest.fn().mockResolvedValue({ doctors: [], total: 0 });
        await doctorService.getAllDoctorsWithCompleteProfile({ page: 1, limit: 5 });
        expect(cache.getOrSet).toHaveBeenCalledWith('doctors:complete:page:1:limit:5', expect.any(Function), 300);
    });

    test('getAllVerifiedDoctors uses its own cache namespace', async () => {
        userRepository.findVerifiedDoctors = jest.fn().mockResolvedValue({ doctors: [], total: 0 });
        await doctorService.getAllVerifiedDoctors({ page: 1, limit: 5 });
        expect(cache.getOrSet).toHaveBeenCalledWith('doctors:verified:page:1:limit:5', expect.any(Function), 300);
    });
});

describe('getADoctor', () => {
    test('caches under doctor:<id> for 10 minutes and delegates to findADoctor', async () => {
        userRepository.findADoctor = jest.fn().mockResolvedValue({ id: USER_ID, fullName: 'Dr X' });

        const result = await doctorService.getADoctor(USER_ID);

        expect(cache.getOrSet).toHaveBeenCalledWith(`doctor:${USER_ID}`, expect.any(Function), 600);
        expect(userRepository.findADoctor).toHaveBeenCalledWith(USER_ID);
        expect(result).toEqual({ id: USER_ID, fullName: 'Dr X' });
    });
});

describe('getDoctorsByOnlineStatus / searchDoctors', () => {
    test('getDoctorsByOnlineStatus delegates straight through', async () => {
        userRepository.findDoctorsByOnlineStatus = jest.fn().mockResolvedValue([{ id: 'd1' }]);
        await expect(doctorService.getDoctorsByOnlineStatus(true)).resolves.toEqual([{ id: 'd1' }]);
        expect(userRepository.findDoctorsByOnlineStatus).toHaveBeenCalledWith(true);
    });

    test('searchDoctors rejects queries shorter than 3 characters', async () => {
        await expect(doctorService.searchDoctors('ab')).rejects.toThrow(
            'Search query must be at least 3 characters long'
        );
        await expect(doctorService.searchDoctors('')).rejects.toThrow(
            'Search query must be at least 3 characters long'
        );
        expect(searchService.search).not.toHaveBeenCalled();
    });

    test('searchDoctors delegates to the centralized search service, scoped to the User entity', async () => {
        searchService.search = jest.fn().mockResolvedValue({ results: { user: [{ id: 'd1' }] } });
        await expect(doctorService.searchDoctors('cardio')).resolves.toEqual([{ id: 'd1' }]);
        expect(searchService.search).toHaveBeenCalledWith('cardio', null, 'public', { category: 'User' });
    });

    test('searchDoctors returns an empty array when the search service finds no doctors', async () => {
        searchService.search = jest.fn().mockResolvedValue({ results: {} });
        await expect(doctorService.searchDoctors('cardio')).resolves.toEqual([]);
    });
});

describe('updateAuthInfo', () => {
    test('updates then returns a whitelisted subset of the refreshed user record', async () => {
        userRepository.findById = jest.fn().mockResolvedValue({
            id: USER_ID,
            fullName: 'New Name',
            email: 'doc@example.com',
            role: 'doctor',
            status: 'doctor_active',
            provider: 'local',
            profileImageUrl: 'img.png',
            bannerUrl: 'banner.png',
            departmentSpecialty: 'cardiology',
            mfaEnabled: false,
            createdAt: 'created',
            updatedAt: 'updated',
            // Secrets that must never leak through this method
            password: 'hashed-secret',
        });

        const result = await doctorService.updateAuthInfo(USER_ID, {
            fullName: 'New Name',
            profileImageUrl: 'img.png',
            bannerUrl: 'banner.png',
            departmentSpecialty: 'cardiology',
        });

        expect(userRepository.updateAuthInfo).toHaveBeenCalledWith(USER_ID, {
            fullName: 'New Name',
            profileImageUrl: 'img.png',
            bannerUrl: 'banner.png',
            departmentSpecialty: 'cardiology',
        });
        expect(result).not.toHaveProperty('password');
        expect(result).toEqual({
            id: USER_ID,
            fullName: 'New Name',
            email: 'doc@example.com',
            role: 'doctor',
            status: 'doctor_active',
            provider: 'local',
            profileImageUrl: 'img.png',
            bannerUrl: 'banner.png',
            departmentSpecialty: 'cardiology',
            mfaEnabled: false,
            createdAt: 'created',
            updatedAt: 'updated',
        });
    });
});

// ============================================================================
// updateOnlineStatus - authorization + verification gating
// ============================================================================

describe('updateOnlineStatus', () => {
    test('throws when the user does not exist', async () => {
        userRepository.findById = jest.fn().mockResolvedValue(null);
        await expect(
            doctorService.updateOnlineStatus(USER_ID, true, { sub: USER_ID, role: 'doctor' })
        ).rejects.toThrow('User not found');
    });

    test('throws when the target user is not a doctor', async () => {
        userRepository.findById = jest.fn().mockResolvedValue({ id: USER_ID, role: 'patient', status: 'active' });
        await expect(
            doctorService.updateOnlineStatus(USER_ID, true, { sub: USER_ID, role: 'patient' })
        ).rejects.toThrow('User must be a doctor');
    });

    test('rejects a different, non-admin user trying to change someone else\'s online status', async () => {
        userRepository.findById = jest.fn().mockResolvedValue({ id: USER_ID, role: 'doctor', status: 'doctor_active' });
        await expect(
            doctorService.updateOnlineStatus(USER_ID, true, { sub: 'someone-else', role: 'doctor' })
        ).rejects.toThrow('Unauthorized: Only the doctor or an admin can update online status');
        expect(userRepository.updateOnlineStatus).not.toHaveBeenCalled();
    });

    test('allows an admin to change another doctor\'s online status', async () => {
        userRepository.findById = jest.fn().mockResolvedValue({ id: USER_ID, role: 'doctor', status: 'doctor_active' });
        await expect(
            doctorService.updateOnlineStatus(USER_ID, true, { sub: 'admin-1', role: 'admin' })
        ).resolves.toEqual({ id: USER_ID, isOnline: true });
    });

    test('allows a super_admin to change another doctor\'s online status', async () => {
        userRepository.findById = jest.fn().mockResolvedValue({ id: USER_ID, role: 'doctor', status: 'doctor_active' });
        await expect(
            doctorService.updateOnlineStatus(USER_ID, true, { sub: 'sa-1', role: 'super_admin' })
        ).resolves.toEqual({ id: USER_ID, isOnline: true });
    });

    test('blocks going online when the doctor is not yet fully verified', async () => {
        userRepository.findById = jest.fn().mockResolvedValue({
            id: USER_ID,
            role: 'doctor',
            status: 'pending_doctor_verification',
        });
        await expect(
            doctorService.updateOnlineStatus(USER_ID, true, { sub: USER_ID, role: 'doctor' })
        ).rejects.toThrow('Account must be fully verified before going online');
        expect(userRepository.updateOnlineStatus).not.toHaveBeenCalled();
    });

    test('allows an unverified doctor to go offline (the verification gate only applies to going online)', async () => {
        userRepository.findById = jest.fn().mockResolvedValue({
            id: USER_ID,
            role: 'doctor',
            status: 'pending_doctor_verification',
        });
        await expect(
            doctorService.updateOnlineStatus(USER_ID, false, { sub: USER_ID, role: 'doctor' })
        ).resolves.toEqual({ id: USER_ID, isOnline: false });
    });

    test('on success, persists the new status and invalidates both the detail and list caches', async () => {
        userRepository.findById = jest.fn().mockResolvedValue({ id: USER_ID, role: 'doctor', status: 'doctor_active' });

        await doctorService.updateOnlineStatus(USER_ID, true, { sub: USER_ID, role: 'doctor' });

        expect(userRepository.updateOnlineStatus).toHaveBeenCalledWith(USER_ID, true);
        expect(cache.del).toHaveBeenCalledWith(`doctor:${USER_ID}`);
        expect(cache.invalidatePattern).toHaveBeenCalledWith('doctors:*');
    });
});

describe('getDoctorOnlineStatus', () => {
    test('throws when the user is not found', async () => {
        userRepository.getOnlineStatus = jest.fn().mockResolvedValue(null);
        await expect(doctorService.getDoctorOnlineStatus(USER_ID)).rejects.toThrow('User not found');
    });

    test('returns the id/isOnline shape', async () => {
        userRepository.getOnlineStatus = jest.fn().mockResolvedValue({ id: USER_ID, isOnline: true, extra: 'ignored' });
        await expect(doctorService.getDoctorOnlineStatus(USER_ID)).resolves.toEqual({ id: USER_ID, isOnline: true });
    });
});

describe('isDoctorVerified', () => {
    test('delegates straight through', async () => {
        userRepository.isDoctorVerified = jest.fn().mockResolvedValue(false);
        await expect(doctorService.isDoctorVerified(USER_ID)).resolves.toBe(false);
    });
});

// ============================================================================
// Ratings
// ============================================================================

describe('addUserRating', () => {
    test('rejects self-rating', async () => {
        await expect(doctorService.addUserRating(USER_ID, USER_ID, 5, 'nice')).rejects.toThrow(
            "user's can't rate themselves"
        );
        expect(userRepository.addUserRating).not.toHaveBeenCalled();
    });

    test('delegates to userRepository.addUserRating for a different rater', async () => {
        await doctorService.addUserRating(ADMIN_ID, USER_ID, 5, 'Great doctor');
        expect(userRepository.addUserRating).toHaveBeenCalledWith(USER_ID, 5, 'Great doctor');
    });
});

describe('getUserRatings', () => {
    test('delegates straight through', async () => {
        userRepository.getUserRatings = jest.fn().mockResolvedValue([{ rating: 4 }]);
        await expect(doctorService.getUserRatings(USER_ID)).resolves.toEqual([{ rating: 4 }]);
    });
});
