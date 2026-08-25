/* eslint-env jest */
// Unit tests for DoctorPricingController. setPricing/updatePricing/deletePricing
// are thin delegation to DoctorPricingService (already fully covered in
// doctorPricingService.test.js) and get a light pass here. getDoctorPricing,
// however, contains real inline business logic - a currency-conversion
// pipeline (pick a display currency from query/country, verify it's
// chargeable by a payment provider, convert every price into it via
// USD-pivoted exchange rates, with a USD fallback when a rate is missing) -
// so it gets full coverage of each branch.

jest.mock('../../services/doctorPricingService');
jest.mock('../../../../shared/services/currencyService');

const DoctorPricingService = require('../../services/doctorPricingService');
const CurrencyService = require('../../../../shared/services/currencyService');
const DoctorPricingController = require('../doctorPricingController');

const DOCTOR_ID = 'aaaa0000-0000-0000-0000-000000000001';
const PRICING_ID = 'bbbb0000-0000-0000-0000-000000000002';

function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

let controller;

beforeEach(() => {
    jest.clearAllMocks();
    controller = new DoctorPricingController();

    // Static array fields on CurrencyService - explicitly restored here since
    // these are plain data (not functions), just in case automocking doesn't
    // preserve non-function static class fields verbatim.
    CurrencyService.FALLBACK_PAYSTACK_CURRENCIES = ['NGN', 'USD', 'GHS', 'ZAR', 'KES'];
    CurrencyService.FALLBACK_FLUTTERWAVE_CURRENCIES = [
        'NGN', 'USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS', 'ZAR', 'XAF', 'XOF', 'RWF', 'ZMW',
    ];
    CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('USD');
    CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1, NGN: 460 });
});

describe('setPricing', () => {
    test('returns 201 with the created pricing on success', async () => {
        controller.pricingService.setPricing = jest.fn().mockResolvedValue({ id: PRICING_ID, price: 5000 });
        const req = { params: { doctorId: DOCTOR_ID }, body: { consultationType: 'video', price: 5000 } };
        const res = makeRes();

        await controller.setPricing(req, res);

        expect(controller.pricingService.setPricing).toHaveBeenCalledWith(DOCTOR_ID, req.body);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            pricing: { id: PRICING_ID, price: 5000 },
            message: 'Pricing set successfully',
        });
    });

    test('returns 400 with the error message on failure', async () => {
        controller.pricingService.setPricing = jest.fn().mockRejectedValue(new Error('bad input'));
        const req = { params: { doctorId: DOCTOR_ID }, body: {} };
        const res = makeRes();

        await controller.setPricing(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'bad input' });
    });
});

describe('updatePricing', () => {
    test('returns the updated pricing on success', async () => {
        controller.pricingService.updatePricing = jest.fn().mockResolvedValue({ id: PRICING_ID, price: 6000 });
        const req = { params: { doctorId: DOCTOR_ID, pricingId: PRICING_ID }, body: { price: 6000 } };
        const res = makeRes();

        await controller.updatePricing(req, res);

        expect(controller.pricingService.updatePricing).toHaveBeenCalledWith(DOCTOR_ID, PRICING_ID, { price: 6000 });
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            pricing: { id: PRICING_ID, price: 6000 },
            message: 'Pricing updated successfully',
        });
    });

    test('returns 400 on failure', async () => {
        controller.pricingService.updatePricing = jest.fn().mockRejectedValue(new Error('not found'));
        const req = { params: { doctorId: DOCTOR_ID, pricingId: PRICING_ID }, body: {} };
        const res = makeRes();

        await controller.updatePricing(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

describe('deletePricing', () => {
    test('confirms deletion on success', async () => {
        controller.pricingService.deletePricing = jest.fn().mockResolvedValue(undefined);
        const req = { params: { doctorId: DOCTOR_ID, pricingId: PRICING_ID } };
        const res = makeRes();

        await controller.deletePricing(req, res);

        expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Pricing deleted successfully' });
    });

    test('returns 400 on failure', async () => {
        controller.pricingService.deletePricing = jest.fn().mockRejectedValue(new Error('not found'));
        const req = { params: { doctorId: DOCTOR_ID, pricingId: PRICING_ID } };
        const res = makeRes();

        await controller.deletePricing(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

describe('getDoctorPricing - currency selection and conversion pipeline', () => {
    test('short-circuits with an NGN fallback display currency when the doctor has no pricing at all', async () => {
        controller.pricingService.getDoctorPricing = jest.fn().mockResolvedValue([]);
        const req = { params: { doctorId: DOCTOR_ID }, query: {}, location: null };
        const res = makeRes();

        await controller.getDoctorPricing(req, res);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            pricing: [],
            displayCurrency: 'NGN',
            location: null,
        });
        expect(CurrencyService.getExchangeRates).not.toHaveBeenCalled();
    });

    test('returns items as-is (no conversion) when already stored in the requested/patient currency', async () => {
        controller.pricingService.getDoctorPricing = jest
            .fn()
            .mockResolvedValue([{ id: 'p1', price: 100, currency: 'USD' }]);
        const req = { params: { doctorId: DOCTOR_ID }, query: { currency: 'USD' }, location: null };
        const res = makeRes();

        await controller.getDoctorPricing(req, res);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            pricing: [{ id: 'p1', price: 100, currency: 'USD', displayPrice: 100, displayCurrency: 'USD', converted: false }],
            displayCurrency: 'USD',
            location: null,
        });
    });

    test('converts a stored price through USD into the requested currency using live rates', async () => {
        CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1, NGN: 460 });
        controller.pricingService.getDoctorPricing = jest
            .fn()
            .mockResolvedValue([{ id: 'p1', price: 100, currency: 'NGN' }]);
        const req = { params: { doctorId: DOCTOR_ID }, query: { currency: 'USD' }, location: null };
        const res = makeRes();

        await controller.getDoctorPricing(req, res);

        const [[payload]] = res.json.mock.calls;
        expect(payload.pricing[0]).toEqual(
            expect.objectContaining({
                displayPrice: 0.22, // round((100/460) * 1 * 100) / 100
                displayCurrency: 'USD',
                originalPrice: 100,
                originalCurrency: 'NGN',
                converted: true,
            })
        );
    });

    test('falls back to the country-derived currency when no explicit query currency is given', async () => {
        CurrencyService.getCurrencyForCountry = jest.fn().mockReturnValue('NGN');
        controller.pricingService.getDoctorPricing = jest
            .fn()
            .mockResolvedValue([{ id: 'p1', price: 100, currency: 'NGN' }]);
        const req = { params: { doctorId: DOCTOR_ID }, query: {}, location: { countryCode: 'NG' } };
        const res = makeRes();

        await controller.getDoctorPricing(req, res);

        expect(CurrencyService.getCurrencyForCountry).toHaveBeenCalledWith('NG');
        const [[payload]] = res.json.mock.calls;
        expect(payload.displayCurrency).toBe('NGN');
    });

    test('falls back to USD when the requested currency is not supported by either payment provider', async () => {
        controller.pricingService.getDoctorPricing = jest
            .fn()
            .mockResolvedValue([{ id: 'p1', price: 100, currency: 'USD' }]);
        const req = { params: { doctorId: DOCTOR_ID }, query: { currency: 'JPY' }, location: null };
        const res = makeRes();

        await controller.getDoctorPricing(req, res);

        const [[payload]] = res.json.mock.calls;
        expect(payload.displayCurrency).toBe('USD');
    });

    test('falls back to USD (with a fallback flag) when the target currency has no entry in the rate table', async () => {
        // ZMW is in the supported set (Flutterwave fallback list) but the rate
        // table below doesn't carry it, exercising the "rate missing" branch.
        CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1, NGN: 460 });
        controller.pricingService.getDoctorPricing = jest
            .fn()
            .mockResolvedValue([{ id: 'p1', price: 115, currency: 'NGN' }]);
        const req = { params: { doctorId: DOCTOR_ID }, query: { currency: 'ZMW' }, location: null };
        const res = makeRes();

        await controller.getDoctorPricing(req, res);

        const [[payload]] = res.json.mock.calls;
        expect(payload.pricing[0]).toEqual(
            expect.objectContaining({
                displayPrice: 0.25, // round((115/460) * 100) / 100
                displayCurrency: 'USD',
                converted: true,
                fallback: true,
            })
        );
    });

    test('defaults an item with no stored currency to NGN before converting', async () => {
        CurrencyService.getExchangeRates = jest.fn().mockResolvedValue({ USD: 1, NGN: 460 });
        controller.pricingService.getDoctorPricing = jest.fn().mockResolvedValue([{ id: 'p1', price: 100 }]);
        const req = { params: { doctorId: DOCTOR_ID }, query: { currency: 'USD' }, location: null };
        const res = makeRes();

        await controller.getDoctorPricing(req, res);

        const [[payload]] = res.json.mock.calls;
        expect(payload.pricing[0].originalCurrency).toBe('NGN');
    });

    test('returns 500 with the error message when fetching pricing fails', async () => {
        controller.pricingService.getDoctorPricing = jest.fn().mockRejectedValue(new Error('db unavailable'));
        const req = { params: { doctorId: DOCTOR_ID }, query: {}, location: null };
        const res = makeRes();

        await controller.getDoctorPricing(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'db unavailable' });
    });
});
