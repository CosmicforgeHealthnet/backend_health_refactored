/* eslint-env jest */
// Unit tests for OrderService — checkout, payment, webhook-driven activation,
// vendor fulfilment, and cancellation for vendor-shop orders.
//
// Money-math focus: subtotal -> platformFeeAmount (7% on top, paid by the
// patient) -> grossAmount (what the patient is actually charged) and
// commissionRate/commissionAmount/vendorAmount (deducted from the vendor's
// earnings, currently 0% by default but must scale correctly if configured).
// Both rates are read fresh from platformConfigService (admin-configurable,
// cached) rather than hardcoded, so tests exercise non-default rates too.

jest.mock('../../../../config/database');
jest.mock('../../repositories/orderRepository');
jest.mock('../../repositories/vendorRepository');
jest.mock('../../../cart/repositories/cartRepository');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('./../walletService');
jest.mock('../../../notifications/services/notificationService');
jest.mock('../../../admin-ops/services/platformConfigService');
jest.mock('axios');

const AppDataSource = require('../../../../config/database');
const orderRepository = require('../../repositories/orderRepository');
const vendorRepository = require('../../repositories/vendorRepository');
const cartRepository = require('../../../cart/repositories/cartRepository');
const userRepository = require('../../../auth/repositories/userRepository');
const walletService = require('../walletService');
const NotificationService = require('../../../notifications/services/notificationService');
const platformConfigService = require('../../../admin-ops/services/platformConfigService');
const axios = require('axios');

const orderService = require('../orderService');

const PATIENT_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VENDOR_ID = 'bbbb0000-0000-0000-0000-000000000002';
const VENDOR_USER_ID = 'bbbb0000-0000-0000-0000-000000000003';
const CART_ID = 'cccc0000-0000-0000-0000-000000000004';
const ORDER_ID = 'dddd0000-0000-0000-0000-000000000005';

function makeCart(overrides = {}) {
  return {
    id: CART_ID,
    vendorId: VENDOR_ID,
    patientId: PATIENT_ID,
    status: 'confirmed',
    confirmedTotal: '10000.0000',
    patientNote: null,
    vendorNote: null,
    items: [{ productId: 'prod-1', quantity: 2 }, { productId: 'prod-2', quantity: 3 }],
    ...overrides,
  };
}

function makeOrder(overrides = {}) {
  return {
    id: ORDER_ID,
    orderNumber: 'ORD-123-ABCDE',
    cartId: CART_ID,
    vendorId: VENDOR_ID,
    patientId: PATIENT_ID,
    status: 'pending',
    paymentStatus: 'unpaid',
    subtotal: '10000.0000',
    platformFeeAmount: '700.0000',
    grossAmount: '10700.0000',
    commissionRate: 0,
    commissionAmount: '0.0000',
    vendorAmount: '10000.0000',
    currency: 'NGN',
    ...overrides,
  };
}

// notificationService is constructed once at module-load time inside orderService.js
const mockNotify = NotificationService.mock.instances[0].createNotification;

const mockProductRepo = { decrement: jest.fn().mockResolvedValue(undefined) };

beforeEach(() => {
  jest.clearAllMocks();

  AppDataSource.getRepository = jest.fn().mockReturnValue(mockProductRepo);
  mockProductRepo.decrement.mockReset().mockResolvedValue(undefined);

  cartRepository.findByIdAndPatient = jest.fn().mockResolvedValue(makeCart());
  cartRepository.findById = jest.fn().mockResolvedValue(makeCart());

  orderRepository.findByCartId = jest.fn().mockResolvedValue(null);
  orderRepository.save = jest.fn().mockImplementation((data) => Promise.resolve({ id: ORDER_ID, ...data }));
  orderRepository.findById = jest.fn().mockResolvedValue(makeOrder());
  orderRepository.update = jest.fn().mockResolvedValue(undefined);
  orderRepository.findByPaymentReference = jest.fn().mockResolvedValue(makeOrder());
  orderRepository.findByPatientPaginated = jest.fn().mockResolvedValue({ orders: [], total: 0, page: 1, limit: 20 });
  orderRepository.findByVendorPaginated = jest.fn().mockResolvedValue({ orders: [], total: 0, page: 1, limit: 20 });

  vendorRepository.findByUserId = jest.fn().mockResolvedValue({ id: VENDOR_ID, userId: VENDOR_USER_ID });

  userRepository.findById = jest.fn().mockResolvedValue({ id: PATIENT_ID, email: 'patient@example.com', fullName: 'Pat Ient' });

  walletService.creditOrder = jest.fn().mockResolvedValue(undefined);

  platformConfigService.getPlatformFeeRate = jest.fn().mockResolvedValue(0.07);
  platformConfigService.getVendorCommissionRate = jest.fn().mockResolvedValue(0);

  axios.post = jest.fn().mockResolvedValue({ data: { data: { authorization_url: 'https://paystack.test/pay', link: 'https://flutterwave.test/pay' } } });

  mockNotify.mockReset().mockResolvedValue(undefined);

  delete process.env.DEFAULT_PAYMENT_PROVIDER;
});

// ============================================================================
// SUITE 1 - initiateCheckout: money math
// ============================================================================

describe('initiateCheckout', () => {
  test('throws when cart does not exist', async () => {
    cartRepository.findByIdAndPatient = jest.fn().mockResolvedValue(null);
    await expect(orderService.initiateCheckout(PATIENT_ID, CART_ID)).rejects.toThrow('Cart not found');
  });

  test('throws when cart is not yet confirmed by the vendor', async () => {
    cartRepository.findByIdAndPatient = jest.fn().mockResolvedValue(makeCart({ status: 'submitted' }));
    await expect(orderService.initiateCheckout(PATIENT_ID, CART_ID)).rejects.toThrow(
      'Cart must be confirmed by the vendor before checkout'
    );
  });

  test('computes platform fee (7% on top) and vendor amount (0% commission) correctly at default rates', async () => {
    const result = await orderService.initiateCheckout(PATIENT_ID, CART_ID);

    expect(orderRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: 10000,
        platformFeeAmount: 700,   // 10000 * 0.07
        grossAmount: 10700,       // 10000 + 700 — what the patient pays
        commissionRate: 0,
        commissionAmount: 0,
        vendorAmount: 10000,      // vendor keeps the full subtotal at 0% commission
        currency: 'NGN',
      })
    );
    expect(result.grossAmount).toBe(10700);
    expect(result.vendorAmount).toBe(10000);
  });

  test('deducts commission from vendor amount when a non-zero commission rate is configured', async () => {
    platformConfigService.getVendorCommissionRate = jest.fn().mockResolvedValue(0.1); // 10%

    const result = await orderService.initiateCheckout(PATIENT_ID, CART_ID);

    // Commission comes out of the vendor's subtotal, NOT out of the platform fee —
    // the platform fee is a separate, additive charge to the patient.
    expect(result.commissionAmount).toBe(1000);   // 10000 * 0.10
    expect(result.vendorAmount).toBe(9000);        // 10000 - 1000
    expect(result.platformFeeAmount).toBe(700);    // unaffected by commission rate
    expect(result.grossAmount).toBe(10700);        // unaffected by commission rate
  });

  test('rounds money fields to 4 decimal places to avoid floating point drift', async () => {
    cartRepository.findByIdAndPatient = jest.fn().mockResolvedValue(makeCart({ confirmedTotal: '999.995' }));
    platformConfigService.getPlatformFeeRate = jest.fn().mockResolvedValue(0.07);

    await orderService.initiateCheckout(PATIENT_ID, CART_ID);

    const savedArg = orderRepository.save.mock.calls[0][0];
    // 999.995 * 0.07 = 69.99965 -> toFixed(4) -> 69.9997 (parsed back to number)
    expect(savedArg.platformFeeAmount).toBeCloseTo(69.9997, 4);
    expect(savedArg.grossAmount).toBeCloseTo(1069.9947, 4);
  });

  test('returns the existing unpaid order instead of creating a duplicate', async () => {
    const existing = makeOrder({ paymentStatus: 'unpaid' });
    orderRepository.findByCartId = jest.fn().mockResolvedValue(existing);

    const result = await orderService.initiateCheckout(PATIENT_ID, CART_ID);

    expect(orderRepository.save).not.toHaveBeenCalled();
    expect(result.orderId).toBe(existing.id);
  });

  test('throws when a paid order already exists for this cart', async () => {
    orderRepository.findByCartId = jest.fn().mockResolvedValue(makeOrder({ paymentStatus: 'paid' }));
    await expect(orderService.initiateCheckout(PATIENT_ID, CART_ID)).rejects.toThrow('This cart has already been paid');
    expect(orderRepository.save).not.toHaveBeenCalled();
  });
});

// ============================================================================
// SUITE 2 - initiatePayment: provider selection + amount charged
// ============================================================================

describe('initiatePayment', () => {
  test('throws when order does not exist', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(orderService.initiatePayment(PATIENT_ID, ORDER_ID)).rejects.toThrow('Order not found');
  });

  test('throws when order belongs to a different patient (no leakage of existence)', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ patientId: 'someone-else' }));
    await expect(orderService.initiatePayment(PATIENT_ID, ORDER_ID)).rejects.toThrow('Order not found');
  });

  test('throws when order is already paid', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ paymentStatus: 'paid' }));
    await expect(orderService.initiatePayment(PATIENT_ID, ORDER_ID)).rejects.toThrow('Order has already been paid');
  });

  test('charges the grossAmount (subtotal + platform fee), not the subtotal, via Paystack by default', async () => {
    const result = await orderService.initiatePayment(PATIENT_ID, ORDER_ID);

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.paystack.co/transaction/initialize',
      expect.objectContaining({
        amount: 1070000, // 10700 NGN * 100 kobo
        email: 'patient@example.com',
      }),
      expect.any(Object)
    );
    expect(result.amount).toBe(10700);
    expect(orderRepository.update).toHaveBeenCalledWith(ORDER_ID, expect.objectContaining({
      paymentProvider: 'paystack',
    }));
  });

  test('uses Flutterwave when DEFAULT_PAYMENT_PROVIDER=flutterwave', async () => {
    process.env.DEFAULT_PAYMENT_PROVIDER = 'flutterwave';

    const result = await orderService.initiatePayment(PATIENT_ID, ORDER_ID);

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.flutterwave.com/v3/payments',
      expect.objectContaining({ amount: 10700 }),
      expect.any(Object)
    );
    expect(result.paymentUrl).toBe('https://flutterwave.test/pay');
  });
});

// ============================================================================
// SUITE 3 - handlePaymentSuccess: webhook-driven activation, inventory, wallet
// ============================================================================

describe('handlePaymentSuccess', () => {
  test('throws when no order matches the payment reference', async () => {
    orderRepository.findByPaymentReference = jest.fn().mockResolvedValue(null);
    await expect(orderService.handlePaymentSuccess('ref-1')).rejects.toThrow('Order not found for payment reference');
  });

  test('is idempotent — a second webhook delivery for an already-paid order is a no-op', async () => {
    const paidOrder = makeOrder({ paymentStatus: 'paid' });
    orderRepository.findByPaymentReference = jest.fn().mockResolvedValue(paidOrder);

    const result = await orderService.handlePaymentSuccess('ref-1');

    expect(result).toBe(paidOrder);
    expect(orderRepository.update).not.toHaveBeenCalled();
    expect(walletService.creditOrder).not.toHaveBeenCalled();
    expect(mockProductRepo.decrement).not.toHaveBeenCalled();
  });

  test('marks the order paid/processing, deducts inventory per cart item, and credits the vendor wallet with vendorAmount', async () => {
    await orderService.handlePaymentSuccess('ref-1');

    expect(orderRepository.update).toHaveBeenCalledWith(ORDER_ID, expect.objectContaining({
      paymentStatus: 'paid',
      status: 'processing',
    }));

    // One decrement per distinct cart item, by exactly that item's quantity —
    // this is the guard against overselling: stock must drop by what was
    // actually ordered, not a flat amount or the whole cart's item count.
    expect(mockProductRepo.decrement).toHaveBeenCalledTimes(2);
    expect(mockProductRepo.decrement).toHaveBeenNthCalledWith(1, { id: 'prod-1' }, 'stockQuantity', 2);
    expect(mockProductRepo.decrement).toHaveBeenNthCalledWith(2, { id: 'prod-2' }, 'stockQuantity', 3);

    expect(walletService.creditOrder).toHaveBeenCalledWith(VENDOR_ID, expect.objectContaining({
      orderId: ORDER_ID,
      amountNgn: 10000, // vendorAmount, not subtotal or grossAmount
      reference: 'ref-1',
    }));
  });

  test('skips items with no productId when deducting inventory (e.g. campaign/custom line items)', async () => {
    cartRepository.findById = jest.fn().mockResolvedValue(makeCart({
      items: [{ productId: null, quantity: 1 }, { productId: 'prod-1', quantity: 5 }],
    }));

    await orderService.handlePaymentSuccess('ref-1');

    expect(mockProductRepo.decrement).toHaveBeenCalledTimes(1);
    expect(mockProductRepo.decrement).toHaveBeenCalledWith({ id: 'prod-1' }, 'stockQuantity', 5);
  });

  test('payment success still completes (order paid, wallet credited) even if inventory deduction throws', async () => {
    mockProductRepo.decrement.mockRejectedValue(new Error('DB constraint violation'));

    await expect(orderService.handlePaymentSuccess('ref-1')).resolves.toBeDefined();
    expect(walletService.creditOrder).toHaveBeenCalled();
  });

  test('payment is still marked paid even if vendor/patient notifications fail', async () => {
    mockNotify.mockRejectedValue(new Error('notification service down'));
    await expect(orderService.handlePaymentSuccess('ref-1')).resolves.toBeDefined();
    expect(orderRepository.update).toHaveBeenCalledWith(ORDER_ID, expect.objectContaining({ paymentStatus: 'paid' }));
  });
});

// ============================================================================
// SUITE 4 - completeOrder (vendor)
// ============================================================================

describe('completeOrder', () => {
  test('throws when the caller has no vendor profile', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(orderService.completeOrder(VENDOR_USER_ID, ORDER_ID)).rejects.toThrow('Vendor profile not found');
  });

  test('throws when the order belongs to a different vendor', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ vendorId: 'other-vendor', status: 'processing' }));
    await expect(orderService.completeOrder(VENDOR_USER_ID, ORDER_ID)).rejects.toThrow('Order not found');
  });

  test('throws when order is not in "processing" status', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ status: 'pending' }));
    await expect(orderService.completeOrder(VENDOR_USER_ID, ORDER_ID)).rejects.toThrow(
      'Only processing orders can be marked as completed'
    );
  });

  test('marks a processing order completed', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ status: 'processing' }));
    await orderService.completeOrder(VENDOR_USER_ID, ORDER_ID);
    expect(orderRepository.update).toHaveBeenCalledWith(ORDER_ID, expect.objectContaining({ status: 'completed' }));
  });
});

// ============================================================================
// SUITE 5 - cancelOrder: patient vs vendor, paid-order guard
// ============================================================================

describe('cancelOrder', () => {
  test('patient cancelling someone else\'s order gets "Order not found"', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ patientId: 'someone-else' }));
    await expect(orderService.cancelOrder(PATIENT_ID, ORDER_ID, 'patient')).rejects.toThrow('Order not found');
  });

  test('vendor cancelling an order that is not theirs gets "Order not found"', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ vendorId: 'other-vendor' }));
    await expect(orderService.cancelOrder(VENDOR_USER_ID, ORDER_ID, 'vendor')).rejects.toThrow('Order not found');
  });

  test.each(['completed', 'cancelled'])('refuses to cancel an order with status "%s"', async (status) => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ status }));
    await expect(orderService.cancelOrder(PATIENT_ID, ORDER_ID, 'patient')).rejects.toThrow(
      'Only pending or processing orders can be cancelled'
    );
  });

  test('refuses to self-cancel a paid order — must go through dispute', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ status: 'processing', paymentStatus: 'paid' }));
    await expect(orderService.cancelOrder(PATIENT_ID, ORDER_ID, 'patient')).rejects.toThrow(
      'Paid orders cannot be self-cancelled. Please raise a dispute.'
    );
  });

  test('allows cancelling an unpaid pending order by the patient', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ status: 'pending', paymentStatus: 'unpaid' }));
    await orderService.cancelOrder(PATIENT_ID, ORDER_ID, 'patient');
    expect(orderRepository.update).toHaveBeenCalledWith(ORDER_ID, expect.objectContaining({
      status: 'cancelled',
      cancelledBy: 'patient',
    }));
  });
});

// ============================================================================
// SUITE 6 - Read paths
// ============================================================================

describe('read paths', () => {
  test('getPatientOrderById throws for another patient\'s order', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ patientId: 'someone-else' }));
    await expect(orderService.getPatientOrderById(PATIENT_ID, ORDER_ID)).rejects.toThrow('Order not found');
  });

  test('getVendorOrderById throws when vendor profile missing', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(orderService.getVendorOrderById(VENDOR_USER_ID, ORDER_ID)).rejects.toThrow('Vendor profile not found');
  });

  test('getVendorOrders defaults page/limit and scopes to the vendor', async () => {
    await orderService.getVendorOrders(VENDOR_USER_ID, {});
    expect(orderRepository.findByVendorPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ vendorId: VENDOR_ID, page: 1, limit: 20 })
    );
  });
});
