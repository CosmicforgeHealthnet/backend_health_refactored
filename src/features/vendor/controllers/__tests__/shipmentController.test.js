/* eslint-env jest */
// Light-pass unit tests for vendor ShipmentController — shipmentService is
// fully covered separately; this checks isClientError() status-code mapping.

jest.mock('../../services/shipmentService');
const shipmentService = require('../../services/shipmentService');

const shipmentController = require('../shipmentController');

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const ORDER_ID = 'bbbb0000-0000-0000-0000-000000000002';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
function makeNext() { return jest.fn(); }

beforeEach(() => {
  jest.clearAllMocks();
});

describe('dispatchOrder', () => {
  test('maps "Cannot dispatch an unpaid order" to 400', async () => {
    shipmentService.dispatchOrder = jest.fn().mockRejectedValue(new Error('Cannot dispatch an unpaid order'));
    const req = { params: { orderId: ORDER_ID }, body: {}, user: { id: USER_ID } };
    const res = makeRes();
    await shipmentController.dispatchOrder(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('201s on success', async () => {
    shipmentService.dispatchOrder = jest.fn().mockResolvedValue({ id: 's1', status: 'dispatched' });
    const req = { params: { orderId: ORDER_ID }, body: { deliveryMethod: 'pickup' }, user: { id: USER_ID } };
    const res = makeRes();
    await shipmentController.dispatchOrder(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('forwards an unexpected error to next()', async () => {
    shipmentService.dispatchOrder = jest.fn().mockRejectedValue(new Error('kaboom'));
    const req = { params: { orderId: ORDER_ID }, body: {}, user: { id: USER_ID } };
    const res = makeRes();
    const next = makeNext();
    await shipmentController.dispatchOrder(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('markDelivered', () => {
  test('maps "Shipment is already marked as delivered" to 400', async () => {
    shipmentService.markDelivered = jest.fn().mockRejectedValue(new Error('Shipment is already marked as delivered'));
    const req = { params: { orderId: ORDER_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await shipmentController.markDelivered(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getVendorShipment / getPatientShipment', () => {
  // Regression test: the service throws "No shipment found for this order"
  // (word order "shipment found", not "not found"), which isClientError()'s
  // original `msg.includes("not found")` check silently missed — the request
  // fell through to next(error) and surfaced as a 500 instead of the
  // intended 404 for the very common "not dispatched yet" case. Fixed in
  // shipmentController.js by also matching "No shipment found".
  test('getVendorShipment maps "No shipment found..." to 404, not 500', async () => {
    shipmentService.getByOrderForVendor = jest.fn().mockRejectedValue(new Error('No shipment found for this order'));
    const req = { params: { orderId: ORDER_ID }, user: { id: USER_ID } };
    const res = makeRes();
    const next = makeNext();
    await shipmentController.getVendorShipment(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  test('getPatientShipment maps "No shipment found for this order yet" to 404, not 500', async () => {
    shipmentService.getByOrderForPatient = jest.fn().mockRejectedValue(new Error('No shipment found for this order yet'));
    const req = { params: { orderId: ORDER_ID }, user: { id: USER_ID } };
    const res = makeRes();
    const next = makeNext();
    await shipmentController.getPatientShipment(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  test('getPatientShipment returns 200 with the shipment on success', async () => {
    shipmentService.getByOrderForPatient = jest.fn().mockResolvedValue({ id: 's1', status: 'dispatched' });
    const req = { params: { orderId: ORDER_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await shipmentController.getPatientShipment(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('getSupportedProviders', () => {
  test('returns providers from the service synchronously', () => {
    shipmentService.getSupportedProviders = jest.fn().mockReturnValue([{ key: 'custom', label: 'Custom' }]);
    const res = makeRes();
    shipmentController.getSupportedProviders({}, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, providers: [{ key: 'custom', label: 'Custom' }] });
  });
});
