/* eslint-env jest */
// Unit tests for DoctorAvailabilityController. setAvailability/replaceAvailability/
// getDoctorAvailability/setUnavailability/updateAvailability/deleteAvailability/
// updateUnavailability/deleteUnavailability/getUnavailability are thin
// delegation to DoctorAvailabilityService (already fully covered in
// doctorAvailabilityService.test.js) and get a light pass. getAvailableSlots
// (timezone validation before delegating) and getAvailabilitySummary/
// getDateRange/convertTimeForDisplay (real inline date-range and timezone
// conversion logic, plus per-date error isolation) get full coverage.

jest.mock('../../services/doctorAvailabilityService');
jest.mock('../../../compliance/services/timezoneService');

const DoctorAvailabilityService = require('../../services/doctorAvailabilityService');
const TimezoneService = require('../../../compliance/services/timezoneService');
const DoctorAvailabilityController = require('../doctorAvailabilityController');

const DOCTOR_ID = 'aaaa0000-0000-0000-0000-000000000001';

function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

let controller;

beforeEach(() => {
    jest.clearAllMocks();
    controller = new DoctorAvailabilityController();
    TimezoneService.isValidTimezone = jest.fn().mockReturnValue(true);
});

describe('setAvailability / replaceAvailability - thin delegation', () => {
    test('setAvailability returns 201 with the created availability and a timezone context', async () => {
        controller.availabilityService.setWeeklyAvailability = jest.fn().mockResolvedValue([{ id: 'a1' }]);
        const req = {
            params: { doctorId: DOCTOR_ID },
            body: [{ dayOfWeek: 'monday' }],
            userTimezone: 'UTC',
            location: { timezone: 'UTC' },
        };
        const res = makeRes();

        await controller.setAvailability(req, res);

        expect(controller.availabilityService.setWeeklyAvailability).toHaveBeenCalledWith(DOCTOR_ID, req.body, req);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, availability: [{ id: 'a1' }] })
        );
    });

    test('setAvailability returns 400 with the error message on failure', async () => {
        controller.availabilityService.setWeeklyAvailability = jest.fn().mockRejectedValue(new Error('conflict'));
        const req = { params: { doctorId: DOCTOR_ID }, body: [] };
        const res = makeRes();

        await controller.setAvailability(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'conflict' });
    });

    test('replaceAvailability returns 200 (not 201) on success', async () => {
        controller.availabilityService.replaceWeeklyAvailability = jest.fn().mockResolvedValue([{ id: 'a1' }]);
        const req = { params: { doctorId: DOCTOR_ID }, body: [] };
        const res = makeRes();

        await controller.replaceAvailability(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
    });
});

describe('getDoctorAvailability - thin delegation', () => {
    test('returns availability as-is when no timezone conversion is needed', async () => {
        controller.availabilityService.getDoctorAvailability = jest
            .fn()
            .mockResolvedValue([{ id: 'a1', timezone: 'UTC', startTime: '09:00', endTime: '10:00' }]);
        const req = { params: { doctorId: DOCTOR_ID }, userTimezone: 'UTC' };
        const res = makeRes();

        await controller.getDoctorAvailability(req, res);

        const [[payload]] = res.json.mock.calls;
        expect(payload.availability[0]).not.toHaveProperty('displayTimes');
    });

    test('adds displayTimes when the record timezone differs from the requester\'s', async () => {
        controller.availabilityService.getDoctorAvailability = jest
            .fn()
            .mockResolvedValue([{ id: 'a1', timezone: 'Africa/Lagos', startTime: '09:00', endTime: '10:00' }]);
        TimezoneService.convertToUTC = jest.fn().mockReturnValue('utc-time');
        TimezoneService.convertFromUTC = jest.fn().mockReturnValue({ time: '08:00' });
        const req = { params: { doctorId: DOCTOR_ID }, userTimezone: 'UTC' };
        const res = makeRes();

        await controller.getDoctorAvailability(req, res);

        const [[payload]] = res.json.mock.calls;
        expect(payload.availability[0].displayTimes).toEqual({
            startTime: '08:00',
            endTime: '08:00',
            originalTimezone: 'Africa/Lagos',
            displayTimezone: 'UTC',
        });
    });

    test('returns 500 on failure', async () => {
        controller.availabilityService.getDoctorAvailability = jest.fn().mockRejectedValue(new Error('db down'));
        const req = { params: { doctorId: DOCTOR_ID } };
        const res = makeRes();

        await controller.getDoctorAvailability(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('getAvailableSlots - timezone validation before delegating', () => {
    test('rejects an invalid explicit timezone before ever calling the service', async () => {
        TimezoneService.isValidTimezone = jest.fn().mockReturnValue(false);
        const req = { params: { doctorId: DOCTOR_ID }, query: { date: '2026-09-01', timezone: 'Not/AZone' } };
        const res = makeRes();

        await controller.getAvailableSlots(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid timezone: Not/AZone' });
        expect(controller.availabilityService.getAvailableSlots).not.toHaveBeenCalled();
    });

    test('falls back to the detected location timezone when none is explicitly requested', async () => {
        controller.availabilityService.getAvailableSlots = jest.fn().mockResolvedValue({ doctorTimezone: 'UTC', availableSlots: [] });
        const req = {
            params: { doctorId: DOCTOR_ID },
            query: { date: '2026-09-01' },
            location: { timezone: 'Africa/Lagos' },
        };
        const res = makeRes();

        await controller.getAvailableSlots(req, res);

        expect(controller.availabilityService.getAvailableSlots).toHaveBeenCalledWith(
            DOCTOR_ID,
            '2026-09-01',
            'Africa/Lagos',
            req
        );
    });

    test('reports whether a timezone conversion was applied, based on doctor vs. target timezone', async () => {
        controller.availabilityService.getAvailableSlots = jest
            .fn()
            .mockResolvedValue({ doctorTimezone: 'Africa/Lagos', availableSlots: ['08:00'] });
        const req = { params: { doctorId: DOCTOR_ID }, query: { date: '2026-09-01', timezone: 'UTC' } };
        const res = makeRes();

        await controller.getAvailableSlots(req, res);

        const [[payload]] = res.json.mock.calls;
        expect(payload.timezoneInfo.conversionApplied).toBe(true);
    });

    test('returns 400 on a service failure', async () => {
        controller.availabilityService.getAvailableSlots = jest.fn().mockRejectedValue(new Error('bad date'));
        const req = { params: { doctorId: DOCTOR_ID }, query: { date: 'not-a-date', timezone: 'UTC' } };
        const res = makeRes();

        await controller.getAvailableSlots(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

describe('setUnavailability / updateAvailability / deleteAvailability / updateUnavailability / deleteUnavailability - thin delegation', () => {
    test('setUnavailability returns 201 on success', async () => {
        controller.availabilityService.setUnavailability = jest.fn().mockResolvedValue({ id: 'u1' });
        const req = { params: { doctorId: DOCTOR_ID }, body: {} };
        const res = makeRes();

        await controller.setUnavailability(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('updateAvailability returns 400 on failure', async () => {
        controller.availabilityService.updateAvailability = jest.fn().mockRejectedValue(new Error('not found'));
        const req = { params: { doctorId: DOCTOR_ID, availabilityId: 'a1' }, body: {} };
        const res = makeRes();

        await controller.updateAvailability(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('deleteAvailability confirms deletion on success', async () => {
        controller.availabilityService.deleteAvailability = jest.fn().mockResolvedValue(undefined);
        const req = { params: { doctorId: DOCTOR_ID, availabilityId: 'a1' } };
        const res = makeRes();

        await controller.deleteAvailability(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, message: 'Availability deleted successfully' })
        );
    });

    test('updateUnavailability returns the updated record on success', async () => {
        controller.availabilityService.updateUnavailability = jest.fn().mockResolvedValue({ id: 'u1', reason: 'x' });
        const req = { params: { doctorId: DOCTOR_ID, unavailabilityId: 'u1' }, body: { reason: 'x' } };
        const res = makeRes();

        await controller.updateUnavailability(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, unavailability: { id: 'u1', reason: 'x' } })
        );
    });

    test('deleteUnavailability confirms deletion on success', async () => {
        controller.availabilityService.deleteUnavailability = jest.fn().mockResolvedValue(undefined);
        const req = { params: { doctorId: DOCTOR_ID, unavailabilityId: 'u1' } };
        const res = makeRes();

        await controller.deleteUnavailability(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, message: 'Unavailability deleted successfully' })
        );
    });
});

describe('getUnavailability - validation + delegation', () => {
    test('requires both startDate and endDate', async () => {
        const req = { params: { doctorId: DOCTOR_ID }, query: {} };
        const res = makeRes();

        await controller.getUnavailability(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(controller.availabilityService.findUnavailabilityByDoctor).not.toHaveBeenCalled();
    });

    test('delegates once both dates are present', async () => {
        controller.availabilityService.findUnavailabilityByDoctor = jest.fn().mockResolvedValue([{ id: 'u1' }]);
        const req = { params: { doctorId: DOCTOR_ID }, query: { startDate: '2026-09-01', endDate: '2026-09-02' } };
        const res = makeRes();

        await controller.getUnavailability(req, res);

        expect(controller.availabilityService.findUnavailabilityByDoctor).toHaveBeenCalledWith(
            DOCTOR_ID,
            '2026-09-01',
            '2026-09-02'
        );
    });
});

describe('getDateRange (inline utility)', () => {
    test('generates an inclusive list of ISO dates between start and end', () => {
        expect(controller.getDateRange('2026-09-01', '2026-09-03')).toEqual([
            '2026-09-01',
            '2026-09-02',
            '2026-09-03',
        ]);
    });

    test('returns a single-element array when start and end are the same day', () => {
        expect(controller.getDateRange('2026-09-01', '2026-09-01')).toEqual(['2026-09-01']);
    });
});

describe('convertTimeForDisplay (inline utility)', () => {
    test('delegates to TimezoneService and returns the converted time', () => {
        TimezoneService.convertToUTC = jest.fn().mockReturnValue('utc-value');
        TimezoneService.convertFromUTC = jest.fn().mockReturnValue({ time: '14:30' });

        const result = controller.convertTimeForDisplay('15:30', 'Africa/Lagos', 'UTC');

        expect(result).toBe('14:30');
        expect(TimezoneService.convertToUTC).toHaveBeenCalledWith(expect.any(String), '15:30', 'Africa/Lagos');
        expect(TimezoneService.convertFromUTC).toHaveBeenCalledWith('utc-value', 'UTC');
    });

    test('returns the original time unchanged if conversion throws', () => {
        TimezoneService.convertToUTC = jest.fn().mockImplementation(() => {
            throw new Error('bad timezone');
        });

        expect(controller.convertTimeForDisplay('15:30', 'Bogus/Zone', 'UTC')).toBe('15:30');
    });
});

describe('getAvailabilitySummary - date range aggregation with per-date error isolation', () => {
    test('requires both startDate and endDate', async () => {
        const req = { params: { doctorId: DOCTOR_ID }, query: {} };
        const res = makeRes();

        await controller.getAvailabilitySummary(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('summarizes availability across each date in the range', async () => {
        controller.availabilityService.getAvailableSlots = jest
            .fn()
            .mockResolvedValueOnce({ dayOfWeek: 'tuesday', availableCount: 2, totalSlots: 4, availableSlots: ['09:00', '10:00'] })
            .mockResolvedValueOnce({ dayOfWeek: 'wednesday', availableCount: 0, totalSlots: 0, availableSlots: [] });

        const req = {
            params: { doctorId: DOCTOR_ID },
            query: { startDate: '2026-09-01', endDate: '2026-09-02' },
            userTimezone: 'UTC',
        };
        const res = makeRes();

        await controller.getAvailabilitySummary(req, res);

        const [[payload]] = res.json.mock.calls;
        expect(payload.summary).toEqual([
            {
                date: '2026-09-01',
                dayOfWeek: 'tuesday',
                availableCount: 2,
                totalSlots: 4,
                hasAvailability: true,
                firstAvailableTime: '09:00',
                lastAvailableTime: '10:00',
            },
            {
                date: '2026-09-02',
                dayOfWeek: 'wednesday',
                availableCount: 0,
                totalSlots: 0,
                hasAvailability: false,
                firstAvailableTime: null,
                lastAvailableTime: null,
            },
        ]);
        expect(payload.daysWithAvailability).toBe(1);
        expect(payload.totalDays).toBe(2);
    });

    test('isolates a per-date failure instead of failing the whole summary', async () => {
        controller.availabilityService.getAvailableSlots = jest
            .fn()
            .mockResolvedValueOnce({ dayOfWeek: 'tuesday', availableCount: 1, totalSlots: 1, availableSlots: ['09:00'] })
            .mockRejectedValueOnce(new Error('slot calc failed'));

        const req = {
            params: { doctorId: DOCTOR_ID },
            query: { startDate: '2026-09-01', endDate: '2026-09-02' },
        };
        const res = makeRes();

        await controller.getAvailabilitySummary(req, res);

        const [[payload]] = res.json.mock.calls;
        expect(payload.summary[0].hasAvailability).toBe(true);
        expect(payload.summary[1]).toEqual({
            date: '2026-09-02',
            error: 'slot calc failed',
            hasAvailability: false,
        });
        // The whole request still succeeds even though one date failed.
        expect(res.status).not.toHaveBeenCalledWith(400);
    });

    test('returns 400 if building the date range itself throws', async () => {
        const req = {
            params: { doctorId: DOCTOR_ID },
            query: { startDate: 'not-a-date', endDate: 'also-not-a-date' },
        };
        const res = makeRes();
        // getDateRange loops `while (currentDate <= lastDate)`; invalid Dates
        // compare as false so this doesn't throw, but guard the contract anyway
        // by forcing the summary loop itself to explode.
        controller.getDateRange = jest.fn().mockImplementation(() => {
            throw new Error('bad range');
        });

        await controller.getAvailabilitySummary(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'bad range' });
    });
});
