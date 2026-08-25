/* eslint-env jest */
// Light-pass unit tests for InvoiceController — thin asyncHandler delegation
// to invoiceService (already covered by invoiceService.test.js). Verifies
// the shared resolvePharmacyId 404 guard and correct request -> service arg
// wiring for each endpoint.

jest.mock('../../services/invoiceService');
jest.mock('../../repositories/pharmacyProfileRepository');

const invoiceService      = require('../../services/invoiceService');
const pharmacyProfileRepo = require('../../repositories/pharmacyProfileRepository');

const controller = require('../invoiceController');

const USER_ID     = 'aaaa0000-0000-0000-0000-000000000001';
const PHARMACY_ID = 'bbbb0000-0000-0000-0000-000000000002';
const INVOICE_ID  = 'cccc0000-0000-0000-0000-000000000003';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue({ id: PHARMACY_ID });
});

test('createInvoice resolves the pharmacy id and returns 201', async () => {
  invoiceService.createInvoice = jest.fn().mockResolvedValue({ id: INVOICE_ID });
  const req = { user: { sub: USER_ID }, body: { items: [] } };
  const res = makeRes();
  const next = jest.fn();

  await controller.createInvoice(req, res, next);
  await flush();

  expect(invoiceService.createInvoice).toHaveBeenCalledWith(PHARMACY_ID, req.body);
  expect(res.status).toHaveBeenCalledWith(201);
});

test('a caller with no pharmacy profile gets a 404 via next()', async () => {
  pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue(null);
  const req = { user: { sub: USER_ID }, body: {} };
  const res = makeRes();
  const next = jest.fn();

  await controller.createInvoice(req, res, next);
  await flush();

  expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
  expect(invoiceService.createInvoice).not.toHaveBeenCalled();
});

test('listInvoices passes query params and spreads the paginated result', async () => {
  invoiceService.listInvoices = jest.fn().mockResolvedValue({ invoices: [], total: 0 });
  const req = { user: { sub: USER_ID }, query: { page: '1' } };
  const res = makeRes();
  const next = jest.fn();

  await controller.listInvoices(req, res, next);
  await flush();

  expect(invoiceService.listInvoices).toHaveBeenCalledWith(PHARMACY_ID, req.query);
  expect(res.json).toHaveBeenCalledWith({ success: true, invoices: [], total: 0 });
});

test('getInvoice passes params.id through', async () => {
  invoiceService.getInvoice = jest.fn().mockResolvedValue({ id: INVOICE_ID });
  const req = { user: { sub: USER_ID }, params: { id: INVOICE_ID } };
  const res = makeRes();
  const next = jest.fn();

  await controller.getInvoice(req, res, next);
  await flush();

  expect(invoiceService.getInvoice).toHaveBeenCalledWith(PHARMACY_ID, INVOICE_ID);
});

test('updateInvoice passes params.id and body through', async () => {
  invoiceService.updateInvoice = jest.fn().mockResolvedValue({ id: INVOICE_ID });
  const req = { user: { sub: USER_ID }, params: { id: INVOICE_ID }, body: { note: 'x' } };
  const res = makeRes();
  const next = jest.fn();

  await controller.updateInvoice(req, res, next);
  await flush();

  expect(invoiceService.updateInvoice).toHaveBeenCalledWith(PHARMACY_ID, INVOICE_ID, req.body);
});

test('sendInvoice delegates with params.id', async () => {
  invoiceService.sendInvoice = jest.fn().mockResolvedValue({ id: INVOICE_ID, sent: true });
  const req = { user: { sub: USER_ID }, params: { id: INVOICE_ID } };
  const res = makeRes();
  const next = jest.fn();

  await controller.sendInvoice(req, res, next);
  await flush();

  expect(invoiceService.sendInvoice).toHaveBeenCalledWith(PHARMACY_ID, INVOICE_ID);
});

test('cancelInvoice delegates with params.id', async () => {
  invoiceService.cancelInvoice = jest.fn().mockResolvedValue({ id: INVOICE_ID, status: 'cancelled' });
  const req = { user: { sub: USER_ID }, params: { id: INVOICE_ID } };
  const res = makeRes();
  const next = jest.fn();

  await controller.cancelInvoice(req, res, next);
  await flush();

  expect(invoiceService.cancelInvoice).toHaveBeenCalledWith(PHARMACY_ID, INVOICE_ID);
});

test('markPaid delegates with params.id', async () => {
  invoiceService.markPaid = jest.fn().mockResolvedValue({ id: INVOICE_ID, status: 'paid' });
  const req = { user: { sub: USER_ID }, params: { id: INVOICE_ID } };
  const res = makeRes();
  const next = jest.fn();

  await controller.markPaid(req, res, next);
  await flush();

  expect(invoiceService.markPaid).toHaveBeenCalledWith(PHARMACY_ID, INVOICE_ID);
});

test('a rejected service call reaches next(), not an unhandled rejection', async () => {
  invoiceService.getInvoice = jest.fn().mockRejectedValue(new Error('Invoice not found'));
  const req = { user: { sub: USER_ID }, params: { id: 'nope' } };
  const res = makeRes();
  const next = jest.fn();

  await controller.getInvoice(req, res, next);
  await flush();

  expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invoice not found' }));
});
