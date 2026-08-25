/* eslint-env jest */
// Light-pass unit tests for PharmacyWalletController — thin asyncHandler
// delegation to pharmacyWalletService / pharmacyDisputeService (both
// already covered by their own service test suites). Verifies the shared
// resolvePharmacyId 404 guard and request -> service arg wiring across
// wallet, payout, bank-account, and dispute endpoints.

jest.mock('../../services/pharmacyWalletService');
jest.mock('../../services/pharmacyDisputeService');
jest.mock('../../repositories/pharmacyProfileRepository');

const pharmacyWalletService = require('../../services/pharmacyWalletService');
const pharmacyDisputeService = require('../../services/pharmacyDisputeService');
const pharmacyProfileRepo    = require('../../repositories/pharmacyProfileRepository');

const controller = require('../pharmacyWalletController');

const USER_ID     = 'aaaa0000-0000-0000-0000-000000000001';
const PHARMACY_ID = 'bbbb0000-0000-0000-0000-000000000002';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  res.send   = jest.fn().mockReturnValue(res);
  return res;
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue({ id: PHARMACY_ID });
});

test('getSummary resolves the pharmacy id and returns 200', async () => {
  pharmacyWalletService.getSummary = jest.fn().mockResolvedValue({ balance: 1000 });
  const req = { user: { sub: USER_ID } };
  const res = makeRes();
  const next = jest.fn();

  await controller.getSummary(req, res, next);
  await flush();

  expect(pharmacyWalletService.getSummary).toHaveBeenCalledWith(PHARMACY_ID);
  expect(res.status).toHaveBeenCalledWith(200);
});

test('a caller with no pharmacy profile gets a 404 via next() (shared resolvePharmacyId guard)', async () => {
  pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue(null);
  const req = { user: { sub: USER_ID } };
  const res = makeRes();
  const next = jest.fn();

  await controller.getSummary(req, res, next);
  await flush();

  expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, message: 'Pharmacy profile not found' }));
  expect(pharmacyWalletService.getSummary).not.toHaveBeenCalled();
});

test('getTransactions passes query and spreads the paginated result', async () => {
  pharmacyWalletService.getTransactions = jest.fn().mockResolvedValue({ transactions: [], total: 0 });
  const req = { user: { sub: USER_ID }, query: { page: '1' } };
  const res = makeRes();
  const next = jest.fn();

  await controller.getTransactions(req, res, next);
  await flush();

  expect(pharmacyWalletService.getTransactions).toHaveBeenCalledWith(PHARMACY_ID, req.query);
  expect(res.json).toHaveBeenCalledWith({ success: true, transactions: [], total: 0 });
});

test('getTransactionReceipt delegates with params.id', async () => {
  pharmacyWalletService.getTransactionReceipt = jest.fn().mockResolvedValue({ id: 'txn-1' });
  const req = { user: { sub: USER_ID }, params: { id: 'txn-1' } };
  const res = makeRes();
  const next = jest.fn();

  await controller.getTransactionReceipt(req, res, next);
  await flush();

  expect(pharmacyWalletService.getTransactionReceipt).toHaveBeenCalledWith(PHARMACY_ID, 'txn-1');
});

test('getEarnings passes query through', async () => {
  pharmacyWalletService.getEarnings = jest.fn().mockResolvedValue({ total: 5000 });
  const req = { user: { sub: USER_ID }, query: { period: 'month' } };
  const res = makeRes();
  const next = jest.fn();

  await controller.getEarnings(req, res, next);
  await flush();

  expect(pharmacyWalletService.getEarnings).toHaveBeenCalledWith(PHARMACY_ID, req.query);
});

describe('payouts', () => {
  test('getPayouts spreads the paginated result', async () => {
    pharmacyWalletService.getPayouts = jest.fn().mockResolvedValue({ payouts: [], total: 0 });
    const req = { user: { sub: USER_ID }, query: {} };
    const res = makeRes();
    const next = jest.fn();

    await controller.getPayouts(req, res, next);
    await flush();

    expect(res.json).toHaveBeenCalledWith({ success: true, payouts: [], total: 0 });
  });

  test('requestPayout returns 201', async () => {
    pharmacyWalletService.requestPayout = jest.fn().mockResolvedValue({ id: 'payout-1' });
    const req = { user: { sub: USER_ID }, body: { amount: 5000 } };
    const res = makeRes();
    const next = jest.fn();

    await controller.requestPayout(req, res, next);
    await flush();

    expect(pharmacyWalletService.requestPayout).toHaveBeenCalledWith(PHARMACY_ID, req.body);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('cancelPayout delegates with params.payoutId', async () => {
    pharmacyWalletService.cancelPayout = jest.fn().mockResolvedValue({ id: 'payout-1', status: 'cancelled' });
    const req = { user: { sub: USER_ID }, params: { payoutId: 'payout-1' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.cancelPayout(req, res, next);
    await flush();

    expect(pharmacyWalletService.cancelPayout).toHaveBeenCalledWith(PHARMACY_ID, 'payout-1');
  });
});

describe('bank accounts', () => {
  test('addBankAccount returns 201', async () => {
    pharmacyWalletService.addBankAccount = jest.fn().mockResolvedValue({ id: 'bank-1' });
    const req = { user: { sub: USER_ID }, body: { accountNumber: '0123456789' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.addBankAccount(req, res, next);
    await flush();

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('setDefaultBankAccount delegates with params.accountId', async () => {
    pharmacyWalletService.setDefaultBankAccount = jest.fn().mockResolvedValue({ id: 'bank-1', isDefault: true });
    const req = { user: { sub: USER_ID }, params: { accountId: 'bank-1' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.setDefaultBankAccount(req, res, next);
    await flush();

    expect(pharmacyWalletService.setDefaultBankAccount).toHaveBeenCalledWith(PHARMACY_ID, 'bank-1');
  });

  test('deleteBankAccount returns 204 with no body', async () => {
    pharmacyWalletService.deleteBankAccount = jest.fn().mockResolvedValue(undefined);
    const req = { user: { sub: USER_ID }, params: { accountId: 'bank-1' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.deleteBankAccount(req, res, next);
    await flush();

    expect(pharmacyWalletService.deleteBankAccount).toHaveBeenCalledWith(PHARMACY_ID, 'bank-1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });
});

describe('disputes', () => {
  test('getDisputes spreads the paginated result', async () => {
    pharmacyDisputeService.listDisputes = jest.fn().mockResolvedValue({ disputes: [], total: 0 });
    const req = { user: { sub: USER_ID }, query: {} };
    const res = makeRes();
    const next = jest.fn();

    await controller.getDisputes(req, res, next);
    await flush();

    expect(pharmacyDisputeService.listDisputes).toHaveBeenCalledWith(PHARMACY_ID, req.query);
  });

  test('respondToDispute delegates with params.disputeId and body', async () => {
    pharmacyDisputeService.respondToDispute = jest.fn().mockResolvedValue({ id: 'dispute-1', status: 'responded' });
    const req = { user: { sub: USER_ID }, params: { disputeId: 'dispute-1' }, body: { response: 'We shipped it' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.respondToDispute(req, res, next);
    await flush();

    expect(pharmacyDisputeService.respondToDispute).toHaveBeenCalledWith(PHARMACY_ID, 'dispute-1', req.body);
  });
});

test('a rejected service call reaches next(), not an unhandled rejection', async () => {
  pharmacyWalletService.requestPayout = jest.fn().mockRejectedValue(new Error('Amount exceeds available balance'));
  const req = { user: { sub: USER_ID }, body: { amount: 999999 } };
  const res = makeRes();
  const next = jest.fn();

  await controller.requestPayout(req, res, next);
  await flush();

  expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Amount exceeds available balance' }));
});
