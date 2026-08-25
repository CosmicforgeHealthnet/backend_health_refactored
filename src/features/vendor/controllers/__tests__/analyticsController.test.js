/* eslint-env jest */
// Light-pass unit tests for vendor VendorAnalyticsController — thin
// delegation over analyticsService (fully covered separately). Just checks
// the period-validation branch and success/404 wiring.

jest.mock('../../services/analyticsService');
const analyticsService = require('../../services/analyticsService');

const analyticsController = require('../analyticsController');

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

describe('getOverview', () => {
  test('200s with the overview payload', async () => {
    analyticsService.getOverview = jest.fn().mockResolvedValue({ orders: { total: 1 } });
    const req = { user: { id: USER_ID } };
    const res = makeRes();
    await analyticsController.getOverview(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('404s when vendor profile is not found', async () => {
    analyticsService.getOverview = jest.fn().mockRejectedValue(new Error('Vendor profile not found'));
    const req = { user: { id: USER_ID } };
    const res = makeRes();
    await analyticsController.getOverview(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('getSalesPerformance', () => {
  test('400s on an invalid period before calling the service', async () => {
    const req = { query: { period: 'yearly' }, user: { id: USER_ID } };
    const res = makeRes();
    await analyticsController.getSalesPerformance(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(analyticsService.getSalesPerformance).not.toHaveBeenCalled();
  });

  test('defaults to "daily" when no period is given', async () => {
    analyticsService.getSalesPerformance = jest.fn().mockResolvedValue({ period: 'daily', data: [] });
    const req = { query: {}, user: { id: USER_ID } };
    const res = makeRes();
    await analyticsController.getSalesPerformance(req, res, makeNext());
    expect(analyticsService.getSalesPerformance).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ period: 'daily' }));
  });
});

describe('getProductPerformance / getPromotionPerformance', () => {
  test('getProductPerformance forwards a generic error to next()', async () => {
    analyticsService.getProductPerformance = jest.fn().mockRejectedValue(new Error('DB down'));
    const req = { user: { id: USER_ID } };
    const res = makeRes();
    const next = makeNext();
    await analyticsController.getProductPerformance(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('getPromotionPerformance 200s on success', async () => {
    analyticsService.getPromotionPerformance = jest.fn().mockResolvedValue({ byType: [] });
    const req = { user: { id: USER_ID } };
    const res = makeRes();
    await analyticsController.getPromotionPerformance(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
