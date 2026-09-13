/* eslint-env jest */
// Unit tests for vendor VendorAnalyticsService — read-only aggregation
// dashboards. Since every query goes through TypeORM's QueryBuilder, the
// mock below builds a fluent, chainable double per getRepository() call and
// lets each test decide what getCount/getRawOne/getRawMany/getMany resolve
// to. Focus is on the aggregation math actually being reported the way
// callers expect (numbers not strings, safe defaults, correct fixed-point
// formatting) rather than the exact SQL generated.

jest.mock('../../../../config/database');
jest.mock('../../repositories/vendorRepository');

const AppDataSource = require('../../../../config/database');
const vendorRepository = require('../../repositories/vendorRepository');

const analyticsService = require('../analyticsService');

const VENDOR_USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VENDOR_ID = 'bbbb0000-0000-0000-0000-000000000002';

// Builds a chainable QueryBuilder mock whose terminal methods resolve to the
// given values (only the ones a given call site actually needs must be set).
function makeQB({ count, rawOne, rawMany, many } = {}) {
  const qb = {};
  const chain = ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'orderBy', 'limit', 'leftJoin', 'innerJoin'];
  chain.forEach((m) => { qb[m] = jest.fn().mockReturnValue(qb); });
  qb.getCount = jest.fn().mockResolvedValue(count ?? 0);
  qb.getRawOne = jest.fn().mockResolvedValue(rawOne ?? { total: '0' });
  qb.getRawMany = jest.fn().mockResolvedValue(rawMany ?? []);
  qb.getMany = jest.fn().mockResolvedValue(many ?? []);
  return qb;
}

// Repo-name -> queue of QueryBuilders to hand out (in call order), so a test
// can control what each distinct createQueryBuilder() call in a Promise.all
// resolves to just by pushing values in the order getOverview/etc. calls them.
let qbQueue;

beforeEach(() => {
  jest.clearAllMocks();
  qbQueue = [];

  vendorRepository.findByUserId = jest.fn().mockResolvedValue({ id: VENDOR_ID, userId: VENDOR_USER_ID });

  AppDataSource.getRepository = jest.fn().mockReturnValue({
    createQueryBuilder: jest.fn(() => {
      const next = qbQueue.shift();
      return next || makeQB();
    }),
  });
});

// ============================================================================
// SUITE 1 - getOverview
// ============================================================================

describe('getOverview', () => {
  test('throws when caller has no vendor profile', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(analyticsService.getOverview(VENDOR_USER_ID)).rejects.toThrow('Vendor profile not found');
  });

  test('aggregates counts and sums into numeric/fixed-point fields in the documented order', async () => {
    qbQueue = [
      makeQB({ count: 12 }),                          // totalOrders (confirmed carts)
      makeQB({ rawOne: { total: '154000.5' } }),        // totalRevenue
      makeQB({ count: 3 }),                             // pendingCarts
      makeQB({ count: 40 }),                            // totalProducts
      makeQB({ count: 25 }),                            // approvedProducts
      makeQB({ count: 5 }),                             // pendingProducts
      makeQB({ count: 2 }),                             // activePromotions
      makeQB({ rawOne: { total: '105000' } }),          // totalPromoSpend
    ];

    const result = await analyticsService.getOverview(VENDOR_USER_ID);

    expect(result).toEqual({
      orders: { total: 12, pending: 3 },
      revenue: { total: '154000.50', currency: 'NGN' },
      products: { total: 40, approved: 25, pending: 5 },
      promotions: { active: 2, totalSpend: '105000.00' },
    });
  });

  test('defaults revenue/spend to 0.00 when there is no data (COALESCE(...,0) comes back as "0")', async () => {
    qbQueue = [
      makeQB({ count: 0 }),
      makeQB({ rawOne: { total: '0' } }),
      makeQB({ count: 0 }),
      makeQB({ count: 0 }),
      makeQB({ count: 0 }),
      makeQB({ count: 0 }),
      makeQB({ count: 0 }),
      makeQB({ rawOne: { total: '0' } }),
    ];

    const result = await analyticsService.getOverview(VENDOR_USER_ID);
    expect(result.revenue.total).toBe('0.00');
    expect(result.promotions.totalSpend).toBe('0.00');
  });
});

// ============================================================================
// SUITE 2 - getSalesPerformance: period resolution + row shaping
// ============================================================================

describe('getSalesPerformance', () => {
  test('throws when caller has no vendor profile', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(analyticsService.getSalesPerformance(VENDOR_USER_ID, {})).rejects.toThrow('Vendor profile not found');
  });

  test('converts orders to numbers and revenue to a fixed 2-decimal string per row', async () => {
    qbQueue = [makeQB({ rawMany: [
      { period: '2026-08-01', orders: '3', revenue: '4500.999' },
      { period: '2026-08-02', orders: '1', revenue: '0' },
    ] })];

    const result = await analyticsService.getSalesPerformance(VENDOR_USER_ID, { period: 'daily' });

    expect(result.data).toEqual([
      { period: '2026-08-01', orders: 3, revenue: '4501.00' },
      { period: '2026-08-02', orders: 1, revenue: '0.00' },
    ]);
  });

  test('defaults the lookback window to 7 days for "daily" when no "from" is given', async () => {
    qbQueue = [makeQB({ rawMany: [] })];
    const before = Date.now();

    const result = await analyticsService.getSalesPerformance(VENDOR_USER_ID, { period: 'daily' });

    const diffDays = (before - new Date(result.from).getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(7, 1);
  });

  test('defaults the lookback window to 28 days for "weekly"', async () => {
    qbQueue = [makeQB({ rawMany: [] })];
    const before = Date.now();
    const result = await analyticsService.getSalesPerformance(VENDOR_USER_ID, { period: 'weekly' });
    const diffDays = (before - new Date(result.from).getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(28, 1);
  });

  test('defaults the lookback window to 12 months for "monthly"', async () => {
    qbQueue = [makeQB({ rawMany: [] })];
    const before = new Date();
    const result = await analyticsService.getSalesPerformance(VENDOR_USER_ID, { period: 'monthly' });
    const monthsBack = (before.getFullYear() - new Date(result.from).getFullYear()) * 12
      + (before.getMonth() - new Date(result.from).getMonth());
    expect(monthsBack).toBe(12);
  });

  test('honors an explicit "from" date instead of the default lookback', async () => {
    qbQueue = [makeQB({ rawMany: [] })];
    const explicitFrom = '2026-01-01T00:00:00.000Z';
    const result = await analyticsService.getSalesPerformance(VENDOR_USER_ID, { period: 'daily', from: explicitFrom });
    expect(new Date(result.from).toISOString()).toBe(explicitFrom);
  });
});

// ============================================================================
// SUITE 3 - getProductPerformance
// ============================================================================

describe('getProductPerformance', () => {
  test('throws when caller has no vendor profile', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(analyticsService.getProductPerformance(VENDOR_USER_ID)).rejects.toThrow('Vendor profile not found');
  });

  test('shapes topProducts/lowStock/statusBreakdown correctly', async () => {
    qbQueue = [
      makeQB({ rawMany: [
        { productId: 'p1', title: 'Widget', orderCount: '5', totalUnitsSold: '12', revenue: '6000' },
      ] }),
      makeQB({ many: [
        { id: 'p2', title: 'Low item', stockQuantity: 2, category: 'others' },
      ] }),
      makeQB({ rawMany: [
        { status: 'approved', count: '10' },
        { status: 'pending', count: '4' },
      ] }),
    ];

    const result = await analyticsService.getProductPerformance(VENDOR_USER_ID);

    expect(result.topProducts).toEqual([
      { productId: 'p1', title: 'Widget', orderCount: 5, totalUnitsSold: 12, revenue: '6000.00' },
    ]);
    expect(result.lowStock).toEqual([{ id: 'p2', title: 'Low item', stockQuantity: 2, category: 'others' }]);
    expect(result.statusBreakdown).toEqual({ approved: 10, pending: 4 });
  });
});

// ============================================================================
// SUITE 4 - getPromotionPerformance
// ============================================================================

describe('getPromotionPerformance', () => {
  test('throws when caller has no vendor profile', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(analyticsService.getPromotionPerformance(VENDOR_USER_ID)).rejects.toThrow('Vendor profile not found');
  });

  test('shapes byType/byStatus/recentPromotions correctly', async () => {
    qbQueue = [
      makeQB({ rawMany: [{ type: 'boost_account', count: '2', totalSpend: '50000' }] }),
      makeQB({ rawMany: [{ status: 'active', count: '1' }, { status: 'completed', count: '3' }] }),
      makeQB({ many: [{ id: 'promo-1', title: 'Big Sale', type: 'get_sales', status: 'active', pricePaid: 25000, startDate: null, endDate: null }] }),
    ];

    const result = await analyticsService.getPromotionPerformance(VENDOR_USER_ID);

    expect(result.byType).toEqual([{ type: 'boost_account', count: 2, totalSpend: '50000.00' }]);
    expect(result.byStatus).toEqual({ active: 1, completed: 3 });
    expect(result.recentPromotions).toEqual([
      { id: 'promo-1', title: 'Big Sale', type: 'get_sales', status: 'active', pricePaid: 25000, startDate: null, endDate: null },
    ]);
  });
});
