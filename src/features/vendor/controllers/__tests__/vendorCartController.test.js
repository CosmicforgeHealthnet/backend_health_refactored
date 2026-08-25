/* eslint-env jest */
// Light-pass unit tests for VendorCartController — the vendor-side view of
// carts. cartService itself belongs to the (out-of-scope) cart feature and is
// mocked wholesale here; this file only checks vendor-profile guards,
// request validation, error-status mapping, and the formatVendorCart shaping
// (lineTotal/estimatedTotal math) that lives directly in this controller.

jest.mock('../../../cart/services/cartService');
jest.mock('../../repositories/vendorRepository');

const cartService = require('../../../cart/services/cartService');
const vendorRepository = require('../../repositories/vendorRepository');

const vendorCartController = require('../vendorCartController');

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VENDOR_ID = 'bbbb0000-0000-0000-0000-000000000002';
const CART_ID = 'cccc0000-0000-0000-0000-000000000003';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
function makeNext() { return jest.fn(); }

beforeEach(() => {
  jest.clearAllMocks();
  vendorRepository.findByUserId = jest.fn().mockResolvedValue({ id: VENDOR_ID });
});

describe('vendor-profile guard (shared across all endpoints)', () => {
  test('getVendorCarts 404s when caller has no vendor profile', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    const req = { query: {}, user: { id: USER_ID } };
    const res = makeRes();
    await vendorCartController.getVendorCarts(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(cartService.getVendorCarts).not.toHaveBeenCalled();
  });
});

describe('getVendorCartById', () => {
  test('formats items with a computed lineTotal and cart-level estimatedTotal', async () => {
    cartService.getVendorCartById = jest.fn().mockResolvedValue({
      id: CART_ID, status: 'submitted',
      items: [
        { id: 'i1', productId: 'p1', quantity: 2, priceSnapshot: '150.50' },
        { id: 'i2', productId: 'p2', quantity: 1, priceSnapshot: '99.99' },
      ],
    });
    const req = { params: { cartId: CART_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await vendorCartController.getVendorCartById(req, res, makeNext());

    const cart = res.json.mock.calls[0][0].cart;
    expect(cart.items[0].lineTotal).toBe('301.00'); // 150.50 * 2
    expect(cart.items[1].lineTotal).toBe('99.99');
    expect(cart.itemCount).toBe(2);
    expect(cart.estimatedTotal).toBe('400.99'); // 301 + 99.99
  });

  test('maps a "not found" service error to 404', async () => {
    cartService.getVendorCartById = jest.fn().mockRejectedValue(new Error('Cart not found'));
    const req = { params: { cartId: CART_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await vendorCartController.getVendorCartById(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('confirmCartPricing', () => {
  test('400s when confirmedTotal is missing', async () => {
    const req = { params: { cartId: CART_ID }, body: {}, user: { id: USER_ID } };
    const res = makeRes();
    await vendorCartController.confirmCartPricing(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(cartService.confirmCartPricing).not.toHaveBeenCalled();
  });

  test('coerces confirmedTotal to a Number before calling the service', async () => {
    cartService.confirmCartPricing = jest.fn().mockResolvedValue({ id: CART_ID, status: 'confirmed', items: [] });
    const req = { params: { cartId: CART_ID }, body: { confirmedTotal: '250.75', vendorNote: 'ok' }, user: { id: USER_ID } };
    const res = makeRes();
    await vendorCartController.confirmCartPricing(req, res, makeNext());
    expect(cartService.confirmCartPricing).toHaveBeenCalledWith(VENDOR_ID, CART_ID, { confirmedTotal: 250.75, vendorNote: 'ok' });
  });

  test('maps a "positive" validation error to 400', async () => {
    cartService.confirmCartPricing = jest.fn().mockRejectedValue(new Error('confirmedTotal must be a positive number'));
    const req = { params: { cartId: CART_ID }, body: { confirmedTotal: -5 }, user: { id: USER_ID } };
    const res = makeRes();
    await vendorCartController.confirmCartPricing(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('cancelCart', () => {
  test('maps "already" errors to 400', async () => {
    cartService.vendorCancelCart = jest.fn().mockRejectedValue(new Error('Cart is already cancelled'));
    const req = { params: { cartId: CART_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await vendorCartController.cancelCart(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('succeeds and returns the formatted cart', async () => {
    cartService.vendorCancelCart = jest.fn().mockResolvedValue({ id: CART_ID, status: 'cancelled', items: [] });
    const req = { params: { cartId: CART_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await vendorCartController.cancelCart(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
