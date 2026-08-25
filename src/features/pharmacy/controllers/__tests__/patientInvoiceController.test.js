/* eslint-env jest */
// Light-pass unit tests for PatientInvoiceController — thin asyncHandler
// delegation to pharmacyPaymentService / pharmacyDisputeService (both
// already covered by their own service test suites). Verifies request ->
// service arg wiring, including the countryCode fallback chain in
// initiatePayment.

jest.mock('../../services/pharmacyPaymentService');
jest.mock('../../services/pharmacyDisputeService');

const pharmacyPaymentService = require('../../services/pharmacyPaymentService');
const pharmacyDisputeService = require('../../services/pharmacyDisputeService');

const controller = require('../patientInvoiceController');

const PATIENT_ID = 'aaaa0000-0000-0000-0000-000000000001';
const INVOICE_ID = 'bbbb0000-0000-0000-0000-000000000002';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
});

test('listInvoices spreads the paginated service result', async () => {
  pharmacyPaymentService.listPatientInvoices = jest.fn().mockResolvedValue({ invoices: [], total: 0 });
  const req = { user: { sub: PATIENT_ID }, query: {} };
  const res = makeRes();
  const next = jest.fn();

  await controller.listInvoices(req, res, next);
  await flush();

  expect(pharmacyPaymentService.listPatientInvoices).toHaveBeenCalledWith(PATIENT_ID, req.query);
  expect(res.json).toHaveBeenCalledWith({ success: true, invoices: [], total: 0 });
});

test('getInvoice delegates with params.id', async () => {
  pharmacyPaymentService.getPatientInvoice = jest.fn().mockResolvedValue({ id: INVOICE_ID });
  const req = { user: { sub: PATIENT_ID }, params: { id: INVOICE_ID } };
  const res = makeRes();
  const next = jest.fn();

  await controller.getInvoice(req, res, next);
  await flush();

  expect(pharmacyPaymentService.getPatientInvoice).toHaveBeenCalledWith(PATIENT_ID, INVOICE_ID);
});

test('markViewed delegates with params.id', async () => {
  pharmacyPaymentService.markViewed = jest.fn().mockResolvedValue({ id: INVOICE_ID, viewed: true });
  const req = { user: { sub: PATIENT_ID }, params: { id: INVOICE_ID } };
  const res = makeRes();
  const next = jest.fn();

  await controller.markViewed(req, res, next);
  await flush();

  expect(pharmacyPaymentService.markViewed).toHaveBeenCalledWith(PATIENT_ID, INVOICE_ID);
});

describe('initiatePayment — countryCode fallback chain', () => {
  test('prefers req.location.countryCode when present', async () => {
    pharmacyPaymentService.initiatePayment = jest.fn().mockResolvedValue({ paymentUrl: 'http://pay' });
    const req = { user: { sub: PATIENT_ID }, body: { invoiceId: INVOICE_ID }, location: { countryCode: 'GB' }, query: { countryCode: 'US' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.initiatePayment(req, res, next);
    await flush();

    expect(pharmacyPaymentService.initiatePayment).toHaveBeenCalledWith(PATIENT_ID, req.body, 'GB');
  });

  test('falls back to req.query.countryCode when location is absent', async () => {
    pharmacyPaymentService.initiatePayment = jest.fn().mockResolvedValue({ paymentUrl: 'http://pay' });
    const req = { user: { sub: PATIENT_ID }, body: { invoiceId: INVOICE_ID }, query: { countryCode: 'US' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.initiatePayment(req, res, next);
    await flush();

    expect(pharmacyPaymentService.initiatePayment).toHaveBeenCalledWith(PATIENT_ID, req.body, 'US');
  });

  test('defaults to "NG" when neither is present', async () => {
    pharmacyPaymentService.initiatePayment = jest.fn().mockResolvedValue({ paymentUrl: 'http://pay' });
    const req = { user: { sub: PATIENT_ID }, body: { invoiceId: INVOICE_ID }, query: {} };
    const res = makeRes();
    const next = jest.fn();

    await controller.initiatePayment(req, res, next);
    await flush();

    expect(pharmacyPaymentService.initiatePayment).toHaveBeenCalledWith(PATIENT_ID, req.body, 'NG');
  });
});

test('verifyPayment delegates with params.reference', async () => {
  pharmacyPaymentService.verifyPayment = jest.fn().mockResolvedValue({ verified: true });
  const req = { user: { sub: PATIENT_ID }, params: { reference: 'ref-1' } };
  const res = makeRes();
  const next = jest.fn();

  await controller.verifyPayment(req, res, next);
  await flush();

  expect(pharmacyPaymentService.verifyPayment).toHaveBeenCalledWith(PATIENT_ID, 'ref-1');
});

test('raiseDispute delegates to pharmacyDisputeService and returns 201', async () => {
  pharmacyDisputeService.raiseDispute = jest.fn().mockResolvedValue({ id: 'dispute-1' });
  const req = { user: { sub: PATIENT_ID }, params: { id: INVOICE_ID }, body: { reason: 'wrong item' } };
  const res = makeRes();
  const next = jest.fn();

  await controller.raiseDispute(req, res, next);
  await flush();

  expect(pharmacyDisputeService.raiseDispute).toHaveBeenCalledWith(PATIENT_ID, INVOICE_ID, req.body);
  expect(res.status).toHaveBeenCalledWith(201);
});

test('a rejected service call reaches next()', async () => {
  pharmacyPaymentService.getPatientInvoice = jest.fn().mockRejectedValue(new Error('Invoice not found'));
  const req = { user: { sub: PATIENT_ID }, params: { id: 'nope' } };
  const res = makeRes();
  const next = jest.fn();

  await controller.getInvoice(req, res, next);
  await flush();

  expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invoice not found' }));
});
