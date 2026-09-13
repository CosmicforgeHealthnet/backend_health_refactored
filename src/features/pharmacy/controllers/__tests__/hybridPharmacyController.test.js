/* eslint-env jest */
// Unit tests for HybridPharmacyController — thin delegation to
// hybridPharmacyService, but the isClientError(msg) matcher is real inline
// logic worth checking against the service's actual thrown messages (cross
// -checked against hybridPharmacyService.js — all matched; no bug found here,
// unlike the near-identical matcher in pharmacySessionController.js).

jest.mock('../../services/hybridPharmacyService');
const hybridPharmacyService = require('../../services/hybridPharmacyService');

const controller = require('../hybridPharmacyController');

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('enableVendorMode', () => {
  test('201s on success', async () => {
    hybridPharmacyService.enableVendorMode = jest.fn().mockResolvedValue({ id: 'vendor-1' });
    const req = { user: { id: USER_ID }, body: { state: 'Lagos', city: 'Lagos' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.enableVendorMode(req, res, next);

    expect(hybridPharmacyService.enableVendorMode).toHaveBeenCalledWith(USER_ID, req.body);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test.each([
    'Pharmacy profile not found for this account',
    'Your pharmacy must be fully approved before enabling vendor mode. Current status: pending',
    'Vendor mode is already enabled for this account',
    'state and city are required to enable vendor mode',
    'Invalid businessCategory. Must be one of: health_wellness, others',
  ])('maps service error "%s" to 400', async (message) => {
    hybridPharmacyService.enableVendorMode = jest.fn().mockRejectedValue(new Error(message));
    const req = { user: { id: USER_ID }, body: {} };
    const res = makeRes();
    const next = jest.fn();

    await controller.enableVendorMode(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('an unrecognized error goes to next()', async () => {
    hybridPharmacyService.enableVendorMode = jest.fn().mockRejectedValue(new Error('unexpected DB failure'));
    const req = { user: { id: USER_ID }, body: {} };
    const res = makeRes();
    const next = jest.fn();

    await controller.enableVendorMode(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('getVendorModeStatus', () => {
  test('200s with the service data spread into the response', async () => {
    hybridPharmacyService.getVendorModeStatus = jest.fn().mockResolvedValue({ enabled: true, vendorId: 'vendor-1' });
    const req = { user: { id: USER_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.getVendorModeStatus(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true, enabled: true, vendorId: 'vendor-1' });
  });

  test('"not found" maps to 404', async () => {
    hybridPharmacyService.getVendorModeStatus = jest.fn().mockRejectedValue(new Error('Pharmacy profile not found for this account'));
    const req = { user: { id: USER_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.getVendorModeStatus(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('disableVendorMode', () => {
  test('200s on success', async () => {
    hybridPharmacyService.disableVendorMode = jest.fn().mockResolvedValue({ disabled: true });
    const req = { user: { id: USER_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.disableVendorMode(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('"Vendor mode is not enabled for this account" maps to 400', async () => {
    hybridPharmacyService.disableVendorMode = jest.fn().mockRejectedValue(new Error('Vendor mode is not enabled for this account'));
    const req = { user: { id: USER_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.disableVendorMode(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
