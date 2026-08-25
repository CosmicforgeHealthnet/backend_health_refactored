/* eslint-env jest */
// Light-pass unit tests for vendor WalletController — a thin 27-line
// delegation layer over walletService (fully covered separately). Just
// confirms the success/404/500 wiring is correct.

jest.mock('../../services/walletService');
const walletService = require('../../services/walletService');

const walletController = require('../walletController');

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';

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

describe('getSummary', () => {
  test('200s with the wallet summary on success', async () => {
    walletService.getWalletSummary = jest.fn().mockResolvedValue({ availableBalanceNgn: 5000 });
    const req = { user: { id: USER_ID } };
    const res = makeRes();
    await walletController.getSummary(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, wallet: { availableBalanceNgn: 5000 } });
  });

  test('404s when vendor profile is not found', async () => {
    walletService.getWalletSummary = jest.fn().mockRejectedValue(new Error('Vendor profile not found'));
    const req = { user: { id: USER_ID } };
    const res = makeRes();
    await walletController.getSummary(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('forwards an unrelated error to next()', async () => {
    walletService.getWalletSummary = jest.fn().mockRejectedValue(new Error('DB down'));
    const req = { user: { id: USER_ID } };
    const res = makeRes();
    const next = makeNext();
    await walletController.getSummary(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('getTransactions', () => {
  test('200s with the paginated transactions', async () => {
    walletService.getTransactions = jest.fn().mockResolvedValue({ transactions: [], total: 0, page: 1, limit: 20 });
    const req = { query: {}, user: { id: USER_ID } };
    const res = makeRes();
    await walletController.getTransactions(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('404s when vendor profile is not found', async () => {
    walletService.getTransactions = jest.fn().mockRejectedValue(new Error('Vendor profile not found'));
    const req = { query: {}, user: { id: USER_ID } };
    const res = makeRes();
    await walletController.getTransactions(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
