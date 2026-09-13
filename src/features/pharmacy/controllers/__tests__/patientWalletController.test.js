/* eslint-env jest */
// Light-pass unit tests for PatientWalletController — thin asyncHandler
// delegation to patientWalletService (already fully covered by
// patientWalletService.test.js). Verifies the countryCode fallback chain
// (shared shape with patientInvoiceController, but defaults to "US" here
// instead of "NG") and request -> service arg wiring.

jest.mock('../../services/patientWalletService');
const patientWalletService = require('../../services/patientWalletService');

const controller = require('../patientWalletController');

const PATIENT_ID = 'aaaa0000-0000-0000-0000-000000000001';

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

describe('countryCode fallback chain (defaults to "US", unlike patientInvoiceController\'s "NG")', () => {
  test('getSummary prefers req.location.countryCode', async () => {
    patientWalletService.getSummary = jest.fn().mockResolvedValue({ balance: 0 });
    const req = { user: { sub: PATIENT_ID }, location: { countryCode: 'GB' }, query: { countryCode: 'NG' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.getSummary(req, res, next);
    await flush();

    expect(patientWalletService.getSummary).toHaveBeenCalledWith(PATIENT_ID, 'GB');
  });

  test('getSummary falls back to req.query.countryCode', async () => {
    patientWalletService.getSummary = jest.fn().mockResolvedValue({ balance: 0 });
    const req = { user: { sub: PATIENT_ID }, query: { countryCode: 'NG' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.getSummary(req, res, next);
    await flush();

    expect(patientWalletService.getSummary).toHaveBeenCalledWith(PATIENT_ID, 'NG');
  });

  test('getSummary defaults to "US" when neither is present', async () => {
    patientWalletService.getSummary = jest.fn().mockResolvedValue({ balance: 0 });
    const req = { user: { sub: PATIENT_ID }, query: {} };
    const res = makeRes();
    const next = jest.fn();

    await controller.getSummary(req, res, next);
    await flush();

    expect(patientWalletService.getSummary).toHaveBeenCalledWith(PATIENT_ID, 'US');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { balance: 0 } });
  });
});

test('getTransactions passes query and countryCode, and spreads the paginated result', async () => {
  patientWalletService.getTransactions = jest.fn().mockResolvedValue({ transactions: [], total: 0 });
  const req = { user: { sub: PATIENT_ID }, query: { page: '1' } };
  const res = makeRes();
  const next = jest.fn();

  await controller.getTransactions(req, res, next);
  await flush();

  expect(patientWalletService.getTransactions).toHaveBeenCalledWith(PATIENT_ID, req.query, 'US');
  expect(res.json).toHaveBeenCalledWith({ success: true, transactions: [], total: 0 });
});

test('topUp delegates to initiateTopUp with the request body', async () => {
  patientWalletService.initiateTopUp = jest.fn().mockResolvedValue({ paymentUrl: 'http://pay' });
  const req = { user: { sub: PATIENT_ID }, body: { amount: 5000 }, query: {} };
  const res = makeRes();
  const next = jest.fn();

  await controller.topUp(req, res, next);
  await flush();

  expect(patientWalletService.initiateTopUp).toHaveBeenCalledWith(PATIENT_ID, req.body, 'US');
  expect(res.status).toHaveBeenCalledWith(200);
});

test('a rejected service call reaches next()', async () => {
  patientWalletService.initiateTopUp = jest.fn().mockRejectedValue(new Error('Amount must be greater than 0'));
  const req = { user: { sub: PATIENT_ID }, body: { amount: -1 }, query: {} };
  const res = makeRes();
  const next = jest.fn();

  await controller.topUp(req, res, next);
  await flush();

  expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Amount must be greater than 0' }));
});
