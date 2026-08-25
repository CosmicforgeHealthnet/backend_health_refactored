/* eslint-env jest */
// Light-pass unit tests for PrescriptionController — thin asyncHandler
// delegation to prescriptionService (already fully covered by
// prescriptionService.test.js). These tests check request wiring
// (params/body/query -> correct service args), the resolvePharmacyId 404
// short-circuit shared by most pharmacy-side methods, the special-cased
// null-prescription 404 in getPrescriptionById, and that a thrown service
// error reaches next() via express-async-handler (no inline try/catch here).

jest.mock('../../services/prescriptionService');
jest.mock('../../repositories/pharmacyProfileRepository');

const PrescriptionService = require('../../services/prescriptionService');
const pharmacyProfileRepo = require('../../repositories/pharmacyProfileRepository');

const controller = require('../prescriptionController');

const USER_ID     = 'aaaa0000-0000-0000-0000-000000000001';
const PHARMACY_ID = 'bbbb0000-0000-0000-0000-000000000002';
const RX_ID       = 'cccc0000-0000-0000-0000-000000000003';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

// asyncHandler does `Promise.resolve(fn(...args)).catch(next)` — give it a
// beat to flush.
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue({ id: PHARMACY_ID });
});

test('createPrescription delegates with doctorId from req.user.sub', async () => {
  PrescriptionService.createPrescription = jest.fn().mockResolvedValue({ id: RX_ID });
  const req = { body: { patientId: 'p1' }, user: { sub: USER_ID } };
  const res = makeRes();
  const next = jest.fn();

  await controller.createPrescription(req, res, next);
  await flush();

  expect(PrescriptionService.createPrescription).toHaveBeenCalledWith(req.body, USER_ID);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: RX_ID } });
});

test('a rejected service promise reaches next(), not an unhandled rejection', async () => {
  const err = Object.assign(new Error('Prescription not found'), { status: 404 });
  PrescriptionService.uploadPrescription = jest.fn().mockRejectedValue(err);
  const req = { params: { prescriptionId: RX_ID }, user: { sub: USER_ID } };
  const res = makeRes();
  const next = jest.fn();

  await controller.uploadPrescription(req, res, next);
  await flush();

  expect(next).toHaveBeenCalledWith(err);
});

describe('resolvePharmacyId 404 guard (shared by pharmacy-side endpoints)', () => {
  test('startProcessing: next() receives a 404 when the caller has no pharmacy profile', async () => {
    pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue(null);
    const req = { params: { prescriptionId: RX_ID }, body: { pharmacistId: 'ph-1' }, user: { sub: USER_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.startProcessing(req, res, next);
    await flush();

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, message: 'Pharmacy profile not found' }));
    expect(PrescriptionService.startProcessing).not.toHaveBeenCalled();
  });

  test('markReady: resolves the profile id then delegates', async () => {
    PrescriptionService.markReady = jest.fn().mockResolvedValue({ id: RX_ID, status: 'ready_for_pickup' });
    const req = { params: { prescriptionId: RX_ID }, body: { readyType: 'pickup' }, user: { sub: USER_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.markReady(req, res, next);
    await flush();

    expect(PrescriptionService.markReady).toHaveBeenCalledWith(RX_ID, PHARMACY_ID, 'pickup', undefined);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('cancelPrescription — pharmacy caller uses profile id, others use their user id', () => {
  test('a pharmacy-role caller is identified by pharmacy profile id, not user id', async () => {
    PrescriptionService.cancelPrescription = jest.fn().mockResolvedValue({ id: RX_ID, status: 'cancelled' });
    const req = { params: { prescriptionId: RX_ID }, body: { reason: 'out of stock' }, user: { sub: USER_ID, role: 'pharmacy' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.cancelPrescription(req, res, next);
    await flush();

    expect(PrescriptionService.cancelPrescription).toHaveBeenCalledWith(RX_ID, PHARMACY_ID, 'out of stock');
  });

  test('a patient-role caller is identified by their own user id', async () => {
    PrescriptionService.cancelPrescription = jest.fn().mockResolvedValue({ id: RX_ID, status: 'cancelled' });
    const req = { params: { prescriptionId: RX_ID }, body: { reason: 'changed mind' }, user: { sub: USER_ID, role: 'patient' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.cancelPrescription(req, res, next);
    await flush();

    expect(PrescriptionService.cancelPrescription).toHaveBeenCalledWith(RX_ID, USER_ID, 'changed mind');
    expect(pharmacyProfileRepo.findByUserId).not.toHaveBeenCalled();
  });

  test('a pharmacy-role caller without a resolvable profile falls back to their user id (not a hard failure)', async () => {
    pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue(null);
    PrescriptionService.cancelPrescription = jest.fn().mockResolvedValue({ id: RX_ID, status: 'cancelled' });
    const req = { params: { prescriptionId: RX_ID }, body: { reason: 'x' }, user: { sub: USER_ID, role: 'pharmacy' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.cancelPrescription(req, res, next);
    await flush();

    expect(PrescriptionService.cancelPrescription).toHaveBeenCalledWith(RX_ID, USER_ID, 'x');
  });
});

describe('getPrescriptionById', () => {
  test('404s when the service returns null', async () => {
    PrescriptionService.getPrescriptionById = jest.fn().mockResolvedValue(null);
    const req = { params: { prescriptionId: RX_ID }, user: { sub: USER_ID, role: 'patient' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.getPrescriptionById(req, res, next);
    await flush();

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Prescription not found' });
  });

  test('200s with the prescription on success', async () => {
    PrescriptionService.getPrescriptionById = jest.fn().mockResolvedValue({ id: RX_ID });
    const req = { params: { prescriptionId: RX_ID }, user: { sub: USER_ID, role: 'patient' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.getPrescriptionById(req, res, next);
    await flush();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: RX_ID } });
  });
});

describe('addChatMessage — sender id resolution depends on senderType', () => {
  test('a patient sender uses their own user id', async () => {
    PrescriptionService.addChatMessage = jest.fn().mockResolvedValue({ id: RX_ID });
    const req = { params: { prescriptionId: RX_ID }, body: { senderType: 'patient', message: 'hi' }, user: { sub: USER_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.addChatMessage(req, res, next);
    await flush();

    expect(PrescriptionService.addChatMessage).toHaveBeenCalledWith(RX_ID, req.body, USER_ID);
    expect(pharmacyProfileRepo.findByUserId).not.toHaveBeenCalled();
  });

  test('a pharmacy sender is resolved to their pharmacy profile id', async () => {
    PrescriptionService.addChatMessage = jest.fn().mockResolvedValue({ id: RX_ID });
    const req = { params: { prescriptionId: RX_ID }, body: { senderType: 'pharmacy', message: 'hi' }, user: { sub: USER_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.addChatMessage(req, res, next);
    await flush();

    expect(PrescriptionService.addChatMessage).toHaveBeenCalledWith(RX_ID, req.body, PHARMACY_ID);
  });
});

describe('initiateDispatch / markDelivered', () => {
  test('initiateDispatch returns the service payload directly (not wrapped in { success, data })', async () => {
    PrescriptionService.initiateDispatch = jest.fn().mockResolvedValue({ id: RX_ID, status: 'out_for_delivery' });
    const req = { params: { prescriptionId: RX_ID }, body: { note: 'On the bike' }, user: { sub: USER_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.initiateDispatch(req, res, next);
    await flush();

    expect(PrescriptionService.initiateDispatch).toHaveBeenCalledWith(RX_ID, PHARMACY_ID, req.body);
    expect(res.json).toHaveBeenCalledWith({ id: RX_ID, status: 'out_for_delivery' });
  });

  test('markDelivered returns the service payload directly', async () => {
    PrescriptionService.markDelivered = jest.fn().mockResolvedValue({ id: RX_ID, status: 'completed' });
    const req = { params: { prescriptionId: RX_ID }, user: { sub: USER_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.markDelivered(req, res, next);
    await flush();

    expect(res.json).toHaveBeenCalledWith({ id: RX_ID, status: 'completed' });
  });
});
