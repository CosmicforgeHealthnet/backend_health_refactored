/* eslint-env jest */
// Unit tests for DoctorAvailabilityService - availability/unavailability CRUD
// and, most importantly, the available-slot calculation (date/time math,
// timezone conversion, overlap/booking detection). This is exactly the kind
// of logic that silently breaks, so the slot-generation and timezone-aware
// filtering paths get the deepest coverage here.
//
// Note: unlike doctorService/doctorVerificationService, this module exports
// the *class*, not a singleton (`module.exports = DoctorAvailabilityService`),
// and its constructor does `this.availabilityRepository = new
// DoctorAvailabilityRepository()` / `this.appointmentRepo = new
// AppointmentRepository()`. Under jest automocking, the mock constructor does
// not replay the real constructor body, so instance properties the real
// constructors assign (`this.repository`, `this.unavailabilityRepository` on
// DoctorAvailabilityRepository) do not exist on the automocked instance —
// they're stubbed back on manually in beforeEach wherever the service reaches
// through to them directly (updateAvailability/deleteAvailability/
// updateUnavailability/deleteUnavailability all do `this.availabilityRepository
// .repository.findOne(...)` / `.unavailabilityRepository....`).
//
// TimezoneService is deliberately NOT mocked - it's exercised for real
// (date-fns-tz) so the timezone-conversion tests below prove the actual
// arithmetic is correct, not just that some mock was called.

jest.mock('../../repositories/doctorAvailabilityRepository');
jest.mock('../../../appointments/repositories/appointmentRepository');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('../../../../shared/utils/cache');

const DoctorAvailabilityService = require('../doctorAvailabilityService');
const userRepository = require('../../../auth/repositories/userRepository');
const cache = require('../../../../shared/utils/cache');

const DOCTOR_ID = 'aaaa0000-0000-0000-0000-000000000001';

let service;

beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();

    service = new DoctorAvailabilityService();

    // Stub back instance properties the real (un-mocked) constructors would
    // have set - see file header comment.
    service.availabilityRepository.repository = { findOne: jest.fn() };
    service.availabilityRepository.unavailabilityRepository = { findOne: jest.fn(), update: jest.fn() };

    service.availabilityRepository.create = jest.fn().mockImplementation(async (data) => ({ id: 'avail-1', ...data }));
    service.availabilityRepository.findByDoctorId = jest.fn().mockResolvedValue([]);
    service.availabilityRepository.findByDoctorAndDay = jest.fn().mockResolvedValue([]);
    service.availabilityRepository.findUnavailabilityByDoctor = jest.fn().mockResolvedValue([]);
    service.availabilityRepository.update = jest.fn().mockResolvedValue({ id: 'avail-1', updated: true });
    service.availabilityRepository.delete = jest.fn().mockResolvedValue(undefined);
    service.availabilityRepository.createUnavailability = jest.fn().mockImplementation(async (data) => ({ id: 'unavail-1', ...data }));

    service.appointmentRepo.findDoctorAvailability = jest.fn().mockResolvedValue([]);

    userRepository.findById = jest.fn().mockResolvedValue({ id: DOCTOR_ID, timezone: 'UTC' });

    cache.get = jest.fn().mockResolvedValue(null);
    cache.set = jest.fn().mockResolvedValue(undefined);
    cache.invalidatePattern = jest.fn().mockResolvedValue(undefined);
});

// ============================================================================
// Pure time-math utilities
// ============================================================================

describe('time utilities', () => {
    test('timeToMinutes / minutesToTime round-trip', () => {
        expect(service.timeToMinutes('09:30')).toBe(570);
        expect(service.minutesToTime(570)).toBe('09:30');
        expect(service.minutesToTime(5)).toBe('00:05');
    });

    test('generateTimeSlots produces slots that fully fit before the end time', () => {
        // 09:00-10:00, 30-min slots, no break -> two slots.
        expect(service.generateTimeSlots('09:00', '10:00', 30, 0)).toEqual(['09:00', '09:30']);
    });

    test('generateTimeSlots accounts for break time between slots', () => {
        // 09:00-10:00, 30-min slots, 10-min break -> step is 40 min.
        // 09:00 fits (ends 09:30 <= 10:00). Next candidate 09:40 ends 10:10 > 10:00, dropped.
        expect(service.generateTimeSlots('09:00', '10:00', 30, 10)).toEqual(['09:00']);
    });

    test('generateTimeSlots returns nothing when the window is smaller than one slot', () => {
        expect(service.generateTimeSlots('09:00', '09:20', 30, 0)).toEqual([]);
    });

    test('normalizeTimeFormat pads single-digit hours/minutes', () => {
        expect(service.normalizeTimeFormat('9:5')).toBe('09:05');
        expect(service.normalizeTimeFormat('09:05')).toBe('09:05');
    });

    test('normalizeTimeFormat passes through a value with no colon unchanged', () => {
        expect(service.normalizeTimeFormat('presentational')).toBe('presentational');
    });

    test('normalizeTimeFormat returns null for falsy input', () => {
        expect(service.normalizeTimeFormat(null)).toBeNull();
        expect(service.normalizeTimeFormat('')).toBeNull();
    });

    test('getDayOfWeek maps a date string to the correct weekday name', () => {
        // 2026-08-25 is a Tuesday.
        expect(service.getDayOfWeek('2026-08-25')).toBe('tuesday');
    });
});

describe('getReferenceDate', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-08-25T12:00:00Z')); // Tuesday
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('returns the next occurrence (or today) of the requested weekday', () => {
        const ref = service.getReferenceDate('sunday');
        expect(ref.getDay()).toBe(0);
        expect(ref.toISOString().slice(0, 10)).toBe('2026-08-30');
    });

    test('returns today itself when the requested day is today', () => {
        const ref = service.getReferenceDate('tuesday');
        expect(ref.toISOString().slice(0, 10)).toBe('2026-08-25');
    });

    test('is case-insensitive', () => {
        const ref = service.getReferenceDate('SUNDAY');
        expect(ref.getDay()).toBe(0);
    });

    test('throws on an invalid day name', () => {
        expect(() => service.getReferenceDate('funday')).toThrow('Invalid day of week: funday');
    });
});

// ============================================================================
// setWeeklyAvailability / replaceWeeklyAvailability
// ============================================================================

describe('setWeeklyAvailability', () => {
    test('rejects a request containing duplicate days', async () => {
        await expect(
            service.setWeeklyAvailability(DOCTOR_ID, [
                { dayOfWeek: 'monday', startTime: '09:00', endTime: '10:00' },
                { dayOfWeek: 'monday', startTime: '11:00', endTime: '12:00' },
            ])
        ).rejects.toThrow('Failed to set availability: Duplicate days found in request: monday');
        expect(service.availabilityRepository.create).not.toHaveBeenCalled();
    });

    test('rejects days that already have availability on file', async () => {
        service.availabilityRepository.findByDoctorId = jest.fn().mockResolvedValue([{ dayOfWeek: 'monday' }]);

        await expect(
            service.setWeeklyAvailability(DOCTOR_ID, [{ dayOfWeek: 'monday', startTime: '09:00', endTime: '10:00' }])
        ).rejects.toThrow(/Doctor already has availability set for: monday/);
    });

    test('stores UTC-equivalent times alongside the doctor timezone for a UTC doctor', async () => {
        const results = await service.setWeeklyAvailability(DOCTOR_ID, [
            { dayOfWeek: 'monday', startTime: '09:00', endTime: '17:00', slotDuration: 30, breakTime: 0 },
        ]);

        expect(service.availabilityRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                doctorId: DOCTOR_ID,
                dayOfWeek: 'monday',
                timezone: 'UTC',
                startTimeUTC: '09:00:00',
                endTimeUTC: '17:00:00',
            })
        );
        expect(results).toHaveLength(1);
        expect(cache.invalidatePattern).toHaveBeenCalledWith(`doctor:availability:${DOCTOR_ID}:*`);
    });

    test('converts a non-UTC doctor timezone to UTC for storage', async () => {
        userRepository.findById = jest.fn().mockResolvedValue({ id: DOCTOR_ID, timezone: 'Africa/Lagos' }); // UTC+1, no DST

        await service.setWeeklyAvailability(DOCTOR_ID, [
            { dayOfWeek: 'monday', startTime: '09:00', endTime: '17:00' },
        ]);

        expect(service.availabilityRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ startTimeUTC: '08:00:00', endTimeUTC: '16:00:00', timezone: 'Africa/Lagos' })
        );
    });

    test('wraps a repository failure with context', async () => {
        service.availabilityRepository.create = jest.fn().mockRejectedValue(new Error('db down'));

        await expect(
            service.setWeeklyAvailability(DOCTOR_ID, [{ dayOfWeek: 'monday', startTime: '09:00', endTime: '10:00' }])
        ).rejects.toThrow('Failed to set availability: db down');
    });
});

describe('replaceWeeklyAvailability', () => {
    test('deletes every existing availability record before creating the new ones', async () => {
        service.availabilityRepository.findByDoctorId = jest.fn().mockResolvedValue([{ id: 'old-1' }, { id: 'old-2' }]);

        await service.replaceWeeklyAvailability(DOCTOR_ID, [
            { dayOfWeek: 'friday', startTime: '09:00', endTime: '12:00' },
        ]);

        expect(service.availabilityRepository.delete).toHaveBeenCalledWith('old-1');
        expect(service.availabilityRepository.delete).toHaveBeenCalledWith('old-2');
        expect(service.availabilityRepository.create).toHaveBeenCalledTimes(1);
    });

    test('still rejects duplicate days in the replacement payload', async () => {
        await expect(
            service.replaceWeeklyAvailability(DOCTOR_ID, [
                { dayOfWeek: 'friday', startTime: '09:00', endTime: '10:00' },
                { dayOfWeek: 'friday', startTime: '10:00', endTime: '11:00' },
            ])
        ).rejects.toThrow('Duplicate days found in request: friday');
        expect(service.availabilityRepository.delete).not.toHaveBeenCalled();
    });
});

// ============================================================================
// getAvailableSlots - the core slot-calculation logic
// ============================================================================

describe('getAvailableSlots', () => {
    test('returns the cached result without touching the repositories on a cache hit', async () => {
        const cached = { date: '2026-08-31', availableSlots: ['09:00'] };
        cache.get = jest.fn().mockResolvedValue(cached);

        const result = await service.getAvailableSlots(DOCTOR_ID, '2026-08-31', 'UTC');

        expect(result).toBe(cached);
        expect(service.availabilityRepository.findByDoctorAndDay).not.toHaveBeenCalled();
    });

    test('reports no availability when the doctor has none set for that weekday', async () => {
        // 2026-08-31 is a Monday.
        const result = await service.getAvailableSlots(DOCTOR_ID, '2026-08-31', 'UTC');

        expect(result).toEqual(
            expect.objectContaining({
                availableSlots: [],
                bookedSlots: [],
                message: 'Doctor not available on this day',
            })
        );
    });

    test('lists every generated slot as available when nothing is booked or unavailable, same timezone', async () => {
        service.availabilityRepository.findByDoctorAndDay = jest.fn().mockResolvedValue([
            { startTime: '09:00', endTime: '11:00', slotDuration: 60, breakTime: 0 },
        ]);

        // Far-future date so the "isToday" past-time filter never engages.
        const result = await service.getAvailableSlots(DOCTOR_ID, '2026-08-31', 'UTC');

        expect(result.availableSlots).toEqual(['09:00', '10:00']);
        expect(result.availableCount).toBe(2);
        expect(result.bookedCount).toBe(0);
        expect(cache.set).toHaveBeenCalledWith(
            `doctor:availability:${DOCTOR_ID}:2026-08-31:UTC`,
            expect.objectContaining({ availableSlots: ['09:00', '10:00'] }),
            300
        );
    });

    test('converts availability into the patient\'s timezone when it differs from the doctor\'s', async () => {
        userRepository.findById = jest.fn().mockResolvedValue({ id: DOCTOR_ID, timezone: 'Africa/Lagos' }); // UTC+1
        service.availabilityRepository.findByDoctorAndDay = jest.fn().mockResolvedValue([
            { startTime: '09:00', endTime: '11:00', slotDuration: 60, breakTime: 0 },
        ]);

        const result = await service.getAvailableSlots(DOCTOR_ID, '2026-08-31', 'UTC');

        // 09:00/10:00 Lagos (UTC+1) -> 08:00/09:00 UTC.
        expect(result.availableSlots).toEqual(['08:00', '09:00']);
        expect(result.doctorTimezone).toBe('Africa/Lagos');
        expect(result.targetTimezone).toBe('UTC');
    });

    test('excludes a slot that is already booked by a confirmed appointment', async () => {
        service.availabilityRepository.findByDoctorAndDay = jest.fn().mockResolvedValue([
            { startTime: '09:00', endTime: '11:00', slotDuration: 60, breakTime: 0 },
        ]);
        service.appointmentRepo.findDoctorAvailability = jest.fn().mockResolvedValue([
            { status: 'confirmed', appointmentTimeUTC: '2026-08-31T09:00:00.000Z' },
        ]);

        const result = await service.getAvailableSlots(DOCTOR_ID, '2026-08-31', 'UTC');

        expect(result.bookedSlots).toEqual(['09:00']);
        expect(result.availableSlots).toEqual(['10:00']);
    });

    test('ignores a cancelled appointment entirely', async () => {
        service.availabilityRepository.findByDoctorAndDay = jest.fn().mockResolvedValue([
            { startTime: '09:00', endTime: '11:00', slotDuration: 60, breakTime: 0 },
        ]);
        service.appointmentRepo.findDoctorAvailability = jest.fn().mockResolvedValue([
            { status: 'cancelled', appointmentTimeUTC: '2026-08-31T09:00:00.000Z' },
        ]);

        const result = await service.getAvailableSlots(DOCTOR_ID, '2026-08-31', 'UTC');

        expect(result.bookedSlots).toEqual([]);
        expect(result.availableSlots).toEqual(['09:00', '10:00']);
    });

    test('counts a fresh pending appointment (created under 10 minutes ago) as booked', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-08-31T08:05:00.000Z'));

        service.availabilityRepository.findByDoctorAndDay = jest.fn().mockResolvedValue([
            { startTime: '09:00', endTime: '11:00', slotDuration: 60, breakTime: 0 },
        ]);
        service.appointmentRepo.findDoctorAvailability = jest.fn().mockResolvedValue([
            {
                status: 'pending',
                createdAt: '2026-08-31T08:00:00.000Z', // 5 minutes ago
                appointmentTimeUTC: '2026-08-31T09:00:00.000Z',
            },
        ]);

        const result = await service.getAvailableSlots(DOCTOR_ID, '2026-08-31', 'UTC');

        expect(result.bookedSlots).toEqual(['09:00']);
    });

    test('releases a stale pending appointment (older than 10 minutes) as no longer booked', async () => {
        // Use a request date far removed from "now" so the today/past-time
        // buffer filter (a separate mechanism, covered below) never engages
        // and this test isolates only the pending-appointment staleness rule.
        service.availabilityRepository.findByDoctorAndDay = jest.fn().mockResolvedValue([
            { startTime: '09:00', endTime: '11:00', slotDuration: 60, breakTime: 0 },
        ]);
        service.appointmentRepo.findDoctorAvailability = jest.fn().mockResolvedValue([
            {
                status: 'pending',
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 minutes ago
                appointmentTimeUTC: '2026-12-31T09:00:00.000Z',
            },
        ]);

        const result = await service.getAvailableSlots(DOCTOR_ID, '2026-12-31', 'UTC');

        expect(result.bookedSlots).toEqual([]);
        expect(result.availableSlots).toContain('09:00');
    });

    test('excludes slots that fall inside a full-day unavailability period', async () => {
        service.availabilityRepository.findByDoctorAndDay = jest.fn().mockResolvedValue([
            { startTime: '09:00', endTime: '11:00', slotDuration: 60, breakTime: 0 },
        ]);
        service.availabilityRepository.findUnavailabilityByDoctor = jest.fn().mockResolvedValue([
            { startTime: null, endTime: null },
        ]);

        const result = await service.getAvailableSlots(DOCTOR_ID, '2026-08-31', 'UTC');

        expect(result.availableSlots).toEqual([]);
    });

    test('excludes only the slots inside a partial unavailability window', async () => {
        service.availabilityRepository.findByDoctorAndDay = jest.fn().mockResolvedValue([
            { startTime: '09:00', endTime: '12:00', slotDuration: 60, breakTime: 0 },
        ]);
        service.availabilityRepository.findUnavailabilityByDoctor = jest.fn().mockResolvedValue([
            { startTime: '10:00', endTime: '11:00' },
        ]);

        const result = await service.getAvailableSlots(DOCTOR_ID, '2026-08-31', 'UTC');

        expect(result.availableSlots).toEqual(['09:00', '11:00']);
    });

    test('filters out today\'s slots inside the 1-hour booking buffer, keeping later ones', async () => {
        jest.useFakeTimers();
        // "Now" is 2026-08-31T09:15:00Z, so anything before 10:15 is within the
        // 60-minute buffer and must be filtered when the requested date is today.
        jest.setSystemTime(new Date('2026-08-31T09:15:00.000Z'));

        service.availabilityRepository.findByDoctorAndDay = jest.fn().mockResolvedValue([
            { startTime: '09:00', endTime: '12:00', slotDuration: 60, breakTime: 0 },
        ]);

        const result = await service.getAvailableSlots(DOCTOR_ID, '2026-08-31', 'UTC');

        // Generated slots are 09:00, 10:00, 11:00. 09:00 and 10:00 fall before
        // the 10:15 cutoff and must be dropped; 11:00 remains.
        expect(result.availableSlots).toEqual(['11:00']);
    });

    test('does not apply the past-time buffer to a future date', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-08-31T23:00:00.000Z'));

        service.availabilityRepository.findByDoctorAndDay = jest.fn().mockResolvedValue([
            { startTime: '09:00', endTime: '11:00', slotDuration: 60, breakTime: 0 },
        ]);

        // Requesting the next day - "now" being late on the 31st must not
        // filter out the morning slots of the 1st.
        const result = await service.getAvailableSlots(DOCTOR_ID, '2026-09-01', 'UTC');

        expect(result.availableSlots).toEqual(['09:00', '10:00']);
    });

    test('wraps a downstream failure with context', async () => {
        userRepository.findById = jest.fn().mockRejectedValue(new Error('user lookup failed'));

        await expect(service.getAvailableSlots(DOCTOR_ID, '2026-08-31', 'UTC')).rejects.toThrow(
            'Failed to get available slots: user lookup failed'
        );
    });
});

// ============================================================================
// Simple delegating / self-healing methods
// ============================================================================

describe('getDoctorAvailability', () => {
    test('delegates straight through', async () => {
        service.availabilityRepository.findByDoctorId = jest.fn().mockResolvedValue([{ id: 'a1' }]);
        await expect(service.getDoctorAvailability(DOCTOR_ID)).resolves.toEqual([{ id: 'a1' }]);
    });
});

describe('setUnavailability', () => {
    test('creates the record and invalidates the availability cache', async () => {
        const result = await service.setUnavailability(DOCTOR_ID, { startDate: '2026-09-01', endDate: '2026-09-02' });

        expect(service.availabilityRepository.createUnavailability).toHaveBeenCalledWith({
            doctorId: DOCTOR_ID,
            startDate: '2026-09-01',
            endDate: '2026-09-02',
        });
        expect(cache.invalidatePattern).toHaveBeenCalledWith(`doctor:availability:${DOCTOR_ID}:*`);
        expect(result.id).toBe('unavail-1');
    });
});

describe('findUnavailabilityByDoctor', () => {
    test('swallows repository errors and returns an empty array instead of throwing', async () => {
        service.availabilityRepository.findUnavailabilityByDoctor = jest.fn().mockRejectedValue(new Error('db error'));

        await expect(service.findUnavailabilityByDoctor(DOCTOR_ID, '2026-09-01', '2026-09-02')).resolves.toEqual([]);
    });

    test('returns the repository result on success', async () => {
        service.availabilityRepository.findUnavailabilityByDoctor = jest.fn().mockResolvedValue([{ id: 'u1' }]);
        await expect(service.findUnavailabilityByDoctor(DOCTOR_ID, '2026-09-01', '2026-09-02')).resolves.toEqual([
            { id: 'u1' },
        ]);
    });
});

describe('updateAvailability', () => {
    test('rejects when the record does not belong to this doctor (double-wrapped error message)', async () => {
        service.availabilityRepository.repository.findOne = jest.fn().mockResolvedValue(null);

        await expect(service.updateAvailability(DOCTOR_ID, 'avail-1', { startTime: '10:00' })).rejects.toThrow(
            'Failed to update availability: Availability record not found or does not belong to this doctor'
        );
    });

    test('updates and invalidates cache when the record is owned by the doctor', async () => {
        service.availabilityRepository.repository.findOne = jest.fn().mockResolvedValue({ id: 'avail-1', doctorId: DOCTOR_ID });

        const result = await service.updateAvailability(DOCTOR_ID, 'avail-1', { startTime: '10:00' });

        expect(service.availabilityRepository.update).toHaveBeenCalledWith(
            'avail-1',
            expect.objectContaining({ startTime: '10:00', updatedAt: expect.any(Date) })
        );
        expect(cache.invalidatePattern).toHaveBeenCalledWith(`doctor:availability:${DOCTOR_ID}:*`);
        expect(result).toEqual({ id: 'avail-1', updated: true });
    });
});

describe('deleteAvailability', () => {
    test('rejects when the record does not belong to this doctor', async () => {
        service.availabilityRepository.repository.findOne = jest.fn().mockResolvedValue(null);

        await expect(service.deleteAvailability(DOCTOR_ID, 'avail-1')).rejects.toThrow(
            'Failed to delete availability: Availability record not found or does not belong to this doctor'
        );
        expect(service.availabilityRepository.delete).not.toHaveBeenCalled();
    });

    test('soft-deletes (via repository.delete) when owned by the doctor', async () => {
        service.availabilityRepository.repository.findOne = jest.fn().mockResolvedValue({ id: 'avail-1' });

        await service.deleteAvailability(DOCTOR_ID, 'avail-1');

        expect(service.availabilityRepository.delete).toHaveBeenCalledWith('avail-1');
    });
});

describe('updateUnavailability', () => {
    test('rejects when the record does not belong to this doctor', async () => {
        service.availabilityRepository.unavailabilityRepository.findOne = jest.fn().mockResolvedValue(null);

        await expect(service.updateUnavailability(DOCTOR_ID, 'unavail-1', {})).rejects.toThrow(
            'Failed to update unavailability: Unavailability record not found or does not belong to this doctor'
        );
    });

    test('updates and re-fetches the record when owned by the doctor', async () => {
        service.availabilityRepository.unavailabilityRepository.findOne = jest
            .fn()
            .mockResolvedValueOnce({ id: 'unavail-1', doctorId: DOCTOR_ID }) // ownership check
            .mockResolvedValueOnce({ id: 'unavail-1', reason: 'Vacation' }); // post-update re-fetch

        const result = await service.updateUnavailability(DOCTOR_ID, 'unavail-1', { reason: 'Vacation' });

        expect(service.availabilityRepository.unavailabilityRepository.update).toHaveBeenCalledWith(
            'unavail-1',
            expect.objectContaining({ reason: 'Vacation', updatedAt: expect.any(Date) })
        );
        expect(result).toEqual({ id: 'unavail-1', reason: 'Vacation' });
    });
});

describe('deleteUnavailability', () => {
    test('rejects when the record does not belong to this doctor', async () => {
        service.availabilityRepository.unavailabilityRepository.findOne = jest.fn().mockResolvedValue(null);

        await expect(service.deleteUnavailability(DOCTOR_ID, 'unavail-1')).rejects.toThrow(
            'Failed to delete unavailability: Unavailability record not found or does not belong to this doctor'
        );
    });

    test('soft-deletes by flipping isActive to false when owned by the doctor', async () => {
        service.availabilityRepository.unavailabilityRepository.findOne = jest.fn().mockResolvedValue({ id: 'unavail-1' });

        await service.deleteUnavailability(DOCTOR_ID, 'unavail-1');

        expect(service.availabilityRepository.unavailabilityRepository.update).toHaveBeenCalledWith('unavail-1', {
            isActive: false,
        });
    });
});
