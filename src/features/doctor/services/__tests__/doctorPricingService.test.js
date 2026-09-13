/* eslint-env jest */
// Unit tests for DoctorPricingService - pricing CRUD (set/get/update/delete).
// Small file, full coverage. Like doctorAvailabilityService, this module
// exports the class itself (`module.exports = DoctorPricingService`), and its
// constructor does `this.pricingRepository = new DoctorPricingRepository()`.

jest.mock('../../repositories/doctorPricingRepository');

const DoctorPricingService = require('../doctorPricingService');

const DOCTOR_ID = 'aaaa0000-0000-0000-0000-000000000001';
const PRICING_ID = 'bbbb0000-0000-0000-0000-000000000002';

let service;

beforeEach(() => {
    jest.clearAllMocks();
    service = new DoctorPricingService();

    service.pricingRepository.findByDoctorAndTypeAndDuration = jest.fn().mockResolvedValue(null);
    service.pricingRepository.update = jest.fn().mockResolvedValue({ id: PRICING_ID, updated: true });
    service.pricingRepository.create = jest.fn().mockImplementation(async (data) => ({ id: PRICING_ID, ...data }));
    service.pricingRepository.findByDoctorId = jest.fn().mockResolvedValue([]);
    service.pricingRepository.delete = jest.fn().mockResolvedValue(undefined);
});

describe('setPricing', () => {
    test('creates new pricing when none exists yet for this type + duration', async () => {
        const pricingData = { consultationType: 'video', duration: 30, price: 5000, currency: 'NGN' };

        const result = await service.setPricing(DOCTOR_ID, pricingData);

        expect(service.pricingRepository.findByDoctorAndTypeAndDuration).toHaveBeenCalledWith(DOCTOR_ID, 'video', 30);
        expect(service.pricingRepository.create).toHaveBeenCalledWith({ doctorId: DOCTOR_ID, ...pricingData });
        expect(service.pricingRepository.update).not.toHaveBeenCalled();
        expect(result).toEqual({ id: PRICING_ID, doctorId: DOCTOR_ID, ...pricingData });
    });

    test('updates the existing record in place when one already exists for this type + duration', async () => {
        service.pricingRepository.findByDoctorAndTypeAndDuration = jest.fn().mockResolvedValue({ id: 'existing-1' });

        await service.setPricing(DOCTOR_ID, { consultationType: 'video', duration: 30, price: 6000, currency: 'NGN' });

        expect(service.pricingRepository.update).toHaveBeenCalledWith('existing-1', {
            price: 6000,
            duration: 30,
            currency: 'NGN',
            updatedAt: expect.any(Date),
        });
        expect(service.pricingRepository.create).not.toHaveBeenCalled();
    });

    test('wraps a repository failure with context', async () => {
        service.pricingRepository.create = jest.fn().mockRejectedValue(new Error('db down'));

        await expect(
            service.setPricing(DOCTOR_ID, { consultationType: 'video', duration: 30, price: 5000, currency: 'NGN' })
        ).rejects.toThrow('Failed to set pricing: db down');
    });
});

describe('getDoctorPricing', () => {
    test('delegates straight through to findByDoctorId', async () => {
        service.pricingRepository.findByDoctorId = jest.fn().mockResolvedValue([{ id: 'p1' }]);
        await expect(service.getDoctorPricing(DOCTOR_ID)).resolves.toEqual([{ id: 'p1' }]);
        expect(service.pricingRepository.findByDoctorId).toHaveBeenCalledWith(DOCTOR_ID);
    });
});

describe('getPricingForConsultationType', () => {
    test('returns the matching pricing record when found', async () => {
        service.pricingRepository.findByDoctorAndTypeAndDuration = jest.fn().mockResolvedValue({ id: 'p1', price: 5000 });

        await expect(service.getPricingForConsultationType(DOCTOR_ID, 'video', 30)).resolves.toEqual({
            id: 'p1',
            price: 5000,
        });
    });

    test('throws a descriptive error when no pricing exists for that type/duration', async () => {
        service.pricingRepository.findByDoctorAndTypeAndDuration = jest.fn().mockResolvedValue(null);

        await expect(service.getPricingForConsultationType(DOCTOR_ID, 'video', 45)).rejects.toThrow(
            'No pricing found for consultation type: video and druration: 45'
        );
    });
});

describe('updatePricing', () => {
    test('delegates the update to the repository', async () => {
        await service.updatePricing(DOCTOR_ID, PRICING_ID, { price: 7000 });
        expect(service.pricingRepository.update).toHaveBeenCalledWith(PRICING_ID, { price: 7000 });
    });
});

describe('deletePricing', () => {
    test('delegates the delete to the repository', async () => {
        await service.deletePricing(DOCTOR_ID, PRICING_ID);
        expect(service.pricingRepository.delete).toHaveBeenCalledWith(PRICING_ID);
    });
});
