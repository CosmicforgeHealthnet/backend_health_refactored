/* eslint-env jest */
// Unit tests for vendor PromotionService — creation gates, pricing math
// (PROMOTION_PRICING + calculatePrice/calculateEndDate), payment-provider
// selection, webhook-driven activation (idempotent), and status transitions.

jest.mock('../../repositories/promotionRepository');
jest.mock('../../repositories/vendorRepository');
jest.mock('../../repositories/productRepository');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('../../../notifications/services/notificationService');
jest.mock('axios');

const promotionRepository = require('../../repositories/promotionRepository');
const vendorRepository = require('../../repositories/vendorRepository');
const productRepository = require('../../repositories/productRepository');
const userRepository = require('../../../auth/repositories/userRepository');
const NotificationService = require('../../../notifications/services/notificationService');
const axios = require('axios');

const promotionService = require('../promotionService');

const VENDOR_USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VENDOR_ID = 'bbbb0000-0000-0000-0000-000000000002';
const PROMOTION_ID = 'cccc0000-0000-0000-0000-000000000003';

function makeVendor(overrides = {}) {
  return { id: VENDOR_ID, userId: VENDOR_USER_ID, verificationStatus: 'approved', ...overrides };
}

function makePromotion(overrides = {}) {
  return {
    id: PROMOTION_ID,
    vendorId: VENDOR_ID,
    type: 'boost_account',
    subType: 'profile_visibility_boost',
    title: 'Boost me',
    duration: 'one_week',
    customDays: null,
    status: 'pending',
    pricePaid: 25000,
    paymentStatus: 'pending',
    ...overrides,
  };
}

const mockNotify = NotificationService.mock.instances[0].createNotification;

beforeEach(() => {
  jest.clearAllMocks();

  vendorRepository.findByUserId = jest.fn().mockResolvedValue(makeVendor());

  promotionRepository.save = jest.fn().mockImplementation((data) => Promise.resolve({ id: PROMOTION_ID, ...data }));
  promotionRepository.findByIdAndVendor = jest.fn().mockResolvedValue(makePromotion());
  promotionRepository.findById = jest.fn().mockResolvedValue(makePromotion());
  promotionRepository.findByReference = jest.fn().mockResolvedValue(makePromotion());
  promotionRepository.update = jest.fn().mockResolvedValue(undefined);
  promotionRepository.delete = jest.fn().mockResolvedValue(undefined);
  promotionRepository.savePromotionProducts = jest.fn().mockResolvedValue(undefined);
  promotionRepository.saveCampaignProduct = jest.fn().mockResolvedValue(undefined);
  promotionRepository.findByVendorPaginated = jest.fn().mockResolvedValue({ promotions: [], total: 0, page: 1, limit: 20 });
  promotionRepository.getActiveByVendor = jest.fn().mockResolvedValue([]);
  promotionRepository.getTrendsByVendor = jest.fn().mockResolvedValue([]);

  productRepository.findByIdAndVendor = jest.fn().mockResolvedValue({ id: 'p1', status: 'approved' });

  userRepository.findById = jest.fn().mockResolvedValue({ id: VENDOR_USER_ID, email: 'vendor@example.com', fullName: 'V Endor' });

  axios.post = jest.fn().mockResolvedValue({ data: { data: { authorization_url: 'https://paystack.test/pay', link: 'https://flutterwave.test/pay' } } });

  mockNotify.mockReset().mockResolvedValue(undefined);

  delete process.env.DEFAULT_PAYMENT_PROVIDER;
});

// ============================================================================
// SUITE 1 - createPromotion
// ============================================================================

describe('createPromotion', () => {
  test('throws when terms are not accepted', async () => {
    await expect(promotionService.createPromotion(VENDOR_USER_ID, { termsAccepted: false })).rejects.toThrow(
      'You must accept the promotion policy terms'
    );
    expect(vendorRepository.findByUserId).not.toHaveBeenCalled();
  });

  test('throws when caller has no vendor profile', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(
      promotionService.createPromotion(VENDOR_USER_ID, { termsAccepted: true })
    ).rejects.toThrow('Vendor profile not found');
  });

  test('throws when vendor is not approved', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(makeVendor({ verificationStatus: 'pending' }));
    await expect(
      promotionService.createPromotion(VENDOR_USER_ID, { termsAccepted: true, type: 'boost_account' })
    ).rejects.toThrow('Your vendor account must be approved to create promotions');
  });

  test('throws on an invalid subType for the given type', async () => {
    await expect(
      promotionService.createPromotion(VENDOR_USER_ID, {
        termsAccepted: true, type: 'boost_account', subType: 'not_a_real_subtype', duration: 'one_week',
      })
    ).rejects.toThrow(/Invalid subType for "boost_account"/);
  });

  test('campaign type skips subType validation entirely', async () => {
    await expect(
      promotionService.createPromotion(VENDOR_USER_ID, {
        termsAccepted: true, type: 'campaign', title: 'My campaign', duration: 'one_day',
      })
    ).resolves.toBeDefined();
  });

  test('computes pricePaid from PROMOTION_PRICING for a fixed duration', async () => {
    await promotionService.createPromotion(VENDOR_USER_ID, {
      termsAccepted: true, type: 'boost_account', subType: 'profile_visibility_boost',
      title: 'x', duration: 'one_month',
    });
    expect(promotionRepository.save).toHaveBeenCalledWith(expect.objectContaining({ pricePaid: 80000 }));
  });

  test('computes pricePaid = per_day * customDays for a custom duration', async () => {
    await promotionService.createPromotion(VENDOR_USER_ID, {
      termsAccepted: true, type: 'boost_account', subType: 'profile_visibility_boost',
      title: 'x', duration: 'custom', customDays: 10,
    });
    expect(promotionRepository.save).toHaveBeenCalledWith(expect.objectContaining({ pricePaid: 50000, customDays: 10 }));
  });

  test('get_sales: rejects more than GET_SALES_MAX_PRODUCTS (5) linked products', async () => {
    await expect(
      promotionService.createPromotion(VENDOR_USER_ID, {
        termsAccepted: true, type: 'get_sales', subType: 'more_orders', title: 'x', duration: 'one_day',
        productIds: ['1', '2', '3', '4', '5', '6'],
      })
    ).rejects.toThrow('Maximum 5 products allowed per Get Sales promotion');
  });

  test('get_sales: rejects a product that does not belong to the vendor or is not approved', async () => {
    productRepository.findByIdAndVendor = jest.fn().mockResolvedValue(null);
    await expect(
      promotionService.createPromotion(VENDOR_USER_ID, {
        termsAccepted: true, type: 'get_sales', subType: 'more_orders', title: 'x', duration: 'one_day',
        productIds: ['p1'],
      })
    ).rejects.toThrow('Product p1 is not available for promotion');
  });

  test('get_sales: rejects a product owned by the vendor but not yet approved', async () => {
    productRepository.findByIdAndVendor = jest.fn().mockResolvedValue({ id: 'p1', status: 'pending' });
    await expect(
      promotionService.createPromotion(VENDOR_USER_ID, {
        termsAccepted: true, type: 'get_sales', subType: 'more_orders', title: 'x', duration: 'one_day',
        productIds: ['p1'],
      })
    ).rejects.toThrow('Product p1 is not available for promotion');
  });

  test('get_sales: links valid products via savePromotionProducts', async () => {
    await promotionService.createPromotion(VENDOR_USER_ID, {
      termsAccepted: true, type: 'get_sales', subType: 'more_orders', title: 'x', duration: 'one_day',
      productIds: ['p1', 'p2'],
    });
    expect(promotionRepository.savePromotionProducts).toHaveBeenCalledWith([
      { promotionId: PROMOTION_ID, productId: 'p1' },
      { promotionId: PROMOTION_ID, productId: 'p2' },
    ]);
  });

  test('campaign: saves the campaign product with stockQuantity defaulted to 0', async () => {
    await promotionService.createPromotion(VENDOR_USER_ID, {
      termsAccepted: true, type: 'campaign', title: 'x', duration: 'one_day',
      campaignProduct: { title: 'New gadget', category: 'others', description: 'd', price: 999 },
    });
    expect(promotionRepository.saveCampaignProduct).toHaveBeenCalledWith(
      expect.objectContaining({ promotionId: PROMOTION_ID, stockQuantity: 0, mediaUrls: [] })
    );
  });
});

// ============================================================================
// SUITE 2 - initiatePayment
// ============================================================================

describe('initiatePayment', () => {
  test('throws when promotion does not belong to this vendor', async () => {
    promotionRepository.findByIdAndVendor = jest.fn().mockResolvedValue(null);
    await expect(promotionService.initiatePayment(VENDOR_USER_ID, PROMOTION_ID)).rejects.toThrow('Promotion not found');
  });

  test('throws when already paid', async () => {
    promotionRepository.findByIdAndVendor = jest.fn().mockResolvedValue(makePromotion({ paymentStatus: 'paid' }));
    await expect(promotionService.initiatePayment(VENDOR_USER_ID, PROMOTION_ID)).rejects.toThrow('This promotion is already paid');
  });

  test('charges exactly pricePaid via Paystack by default', async () => {
    const result = await promotionService.initiatePayment(VENDOR_USER_ID, PROMOTION_ID);
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.paystack.co/transaction/initialize',
      expect.objectContaining({ amount: 2500000, email: 'vendor@example.com' }), // 25000 * 100
      expect.any(Object)
    );
    expect(result.amount).toBe(25000);
  });

  test('uses Flutterwave when configured', async () => {
    process.env.DEFAULT_PAYMENT_PROVIDER = 'flutterwave';
    const result = await promotionService.initiatePayment(VENDOR_USER_ID, PROMOTION_ID);
    expect(axios.post).toHaveBeenCalledWith('https://api.flutterwave.com/v3/payments', expect.any(Object), expect.any(Object));
    expect(result.paymentUrl).toBe('https://flutterwave.test/pay');
  });
});

// ============================================================================
// SUITE 3 - activatePromotion: webhook-driven, idempotent, correct end date
// ============================================================================

describe('activatePromotion', () => {
  test('throws when no promotion matches the reference', async () => {
    promotionRepository.findByReference = jest.fn().mockResolvedValue(null);
    await expect(promotionService.activatePromotion('ref-1')).rejects.toThrow('Promotion not found for this payment reference');
  });

  test('is idempotent for an already-paid promotion', async () => {
    const paid = makePromotion({ paymentStatus: 'paid' });
    promotionRepository.findByReference = jest.fn().mockResolvedValue(paid);
    const result = await promotionService.activatePromotion('ref-1');
    expect(result).toBe(paid);
    expect(promotionRepository.update).not.toHaveBeenCalled();
  });

  test('activates with startDate=now and endDate = now + duration (one_week -> +7 days)', async () => {
    promotionRepository.findByReference = jest.fn().mockResolvedValue(makePromotion({ duration: 'one_week' }));

    await promotionService.activatePromotion('ref-1');

    const updateArg = promotionRepository.update.mock.calls[0][1];
    expect(updateArg.status).toBe('active');
    expect(updateArg.paymentStatus).toBe('paid');
    const diffDays = (updateArg.endDate - updateArg.startDate) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(7, 5);
  });

  test('activation still succeeds even when the notification fails', async () => {
    mockNotify.mockRejectedValue(new Error('down'));
    await expect(promotionService.activatePromotion('ref-1')).resolves.toBeDefined();
  });
});

// ============================================================================
// SUITE 4 - getMyPromotions: auto-expiry side effect
// ============================================================================

describe('getMyPromotions (auto-expiry)', () => {
  test('expires active promotions whose endDate has passed, before returning the page', async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60);
    const future = new Date(Date.now() + 1000 * 60 * 60);
    promotionRepository.getActiveByVendor = jest.fn().mockResolvedValue([
      makePromotion({ id: 'expired-1', endDate: past }),
      makePromotion({ id: 'still-active', endDate: future }),
    ]);

    await promotionService.getMyPromotions(VENDOR_USER_ID, {});

    expect(promotionRepository.update).toHaveBeenCalledTimes(1);
    expect(promotionRepository.update).toHaveBeenCalledWith('expired-1', { status: 'completed' });
  });

  test('does not touch active promotions with no endDate or a future endDate', async () => {
    promotionRepository.getActiveByVendor = jest.fn().mockResolvedValue([
      makePromotion({ id: 'no-end-date', endDate: null }),
    ]);
    await promotionService.getMyPromotions(VENDOR_USER_ID, {});
    expect(promotionRepository.update).not.toHaveBeenCalled();
  });
});

// ============================================================================
// SUITE 5 - updatePromotion / cancelPromotion / deletePromotion status guards
// ============================================================================

describe('updatePromotion', () => {
  test('throws unless the promotion is pending', async () => {
    promotionRepository.findByIdAndVendor = jest.fn().mockResolvedValue(makePromotion({ status: 'active' }));
    await expect(promotionService.updatePromotion(VENDOR_USER_ID, PROMOTION_ID, { title: 'x' })).rejects.toThrow(
      'Only pending promotions can be edited'
    );
  });

  test('recalculates pricePaid when duration changes', async () => {
    await promotionService.updatePromotion(VENDOR_USER_ID, PROMOTION_ID, { duration: 'one_month' });
    expect(promotionRepository.update).toHaveBeenCalledWith(PROMOTION_ID, { duration: 'one_month', pricePaid: 80000 });
  });

  test('only forwards whitelisted fields', async () => {
    await promotionService.updatePromotion(VENDOR_USER_ID, PROMOTION_ID, { title: 'New', vendorId: 'attacker', status: 'active' });
    expect(promotionRepository.update).toHaveBeenCalledWith(PROMOTION_ID, { title: 'New' });
  });
});

describe('cancelPromotion', () => {
  test.each(['completed', 'cancelled'])('refuses to cancel from status "%s"', async (status) => {
    promotionRepository.findByIdAndVendor = jest.fn().mockResolvedValue(makePromotion({ status }));
    await expect(promotionService.cancelPromotion(VENDOR_USER_ID, PROMOTION_ID)).rejects.toThrow(
      'Only pending or active promotions can be cancelled'
    );
  });

  test.each(['pending', 'active'])('allows cancelling from status "%s"', async (status) => {
    promotionRepository.findByIdAndVendor = jest.fn().mockResolvedValue(makePromotion({ status }));
    await promotionService.cancelPromotion(VENDOR_USER_ID, PROMOTION_ID);
    expect(promotionRepository.update).toHaveBeenCalledWith(PROMOTION_ID, { status: 'cancelled' });
  });
});

describe('deletePromotion', () => {
  test('refuses to delete a non-pending promotion', async () => {
    promotionRepository.findByIdAndVendor = jest.fn().mockResolvedValue(makePromotion({ status: 'active' }));
    await expect(promotionService.deletePromotion(VENDOR_USER_ID, PROMOTION_ID)).rejects.toThrow(
      'Only pending promotions can be deleted'
    );
    expect(promotionRepository.delete).not.toHaveBeenCalled();
  });

  test('deletes a pending promotion', async () => {
    await promotionService.deletePromotion(VENDOR_USER_ID, PROMOTION_ID);
    expect(promotionRepository.delete).toHaveBeenCalledWith(PROMOTION_ID);
  });
});
