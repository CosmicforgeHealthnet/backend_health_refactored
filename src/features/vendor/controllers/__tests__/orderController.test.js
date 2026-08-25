/* eslint-env jest */
// Light-pass unit tests for vendor OrderController — orderService itself is
// fully covered separately; this file checks request validation and the
// isClientError() status-code mapping (400/404 vs. next(error) -> 500).

jest.mock('../../services/orderService');
const orderService = require('../../services/orderService');

const orderController = require('../orderController');

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const ORDER_ID = 'bbbb0000-0000-0000-0000-000000000002';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
function makeNext() { return jest.fn(); }

function makeOrder(overrides = {}) {
  return { id: ORDER_ID, orderNumber: 'ORD-1', status: 'pending', paymentStatus: 'unpaid', ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('initiateCheckout', () => {
  test('400s when cartId param missing', async () => {
    const req = { params: {}, user: { id: USER_ID } };
    const res = makeRes();
    await orderController.initiateCheckout(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('maps a "Cart not found" service error to 400', async () => {
    orderService.initiateCheckout = jest.fn().mockRejectedValue(new Error('Cart not found'));
    const req = { params: { cartId: 'c1' }, user: { id: USER_ID } };
    const res = makeRes();
    const next = makeNext();
    await orderController.initiateCheckout(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('forwards an unexpected error to next()', async () => {
    orderService.initiateCheckout = jest.fn().mockRejectedValue(new Error('kaboom'));
    const req = { params: { cartId: 'c1' }, user: { id: USER_ID } };
    const res = makeRes();
    const next = makeNext();
    await orderController.initiateCheckout(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('201s with the checkout payload on success', async () => {
    orderService.initiateCheckout = jest.fn().mockResolvedValue({ orderId: ORDER_ID, grossAmount: 10700 });
    const req = { params: { cartId: 'c1' }, user: { id: USER_ID } };
    const res = makeRes();
    await orderController.initiateCheckout(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, orderId: ORDER_ID }));
  });
});

describe('getMyOrderById', () => {
  test('maps "not found" to 404 (not 400) for GET-by-id', async () => {
    orderService.getPatientOrderById = jest.fn().mockRejectedValue(new Error('Order not found'));
    const req = { params: { orderId: ORDER_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await orderController.getMyOrderById(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('formats the order on success, including derived fee fields', async () => {
    orderService.getPatientOrderById = jest.fn().mockResolvedValue(makeOrder({ platformFeeAmount: 700, grossAmount: 10700 }));
    const req = { params: { orderId: ORDER_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await orderController.getMyOrderById(req, res, makeNext());
    expect(res.json).toHaveBeenCalledWith({ success: true, order: expect.objectContaining({ id: ORDER_ID, grossAmount: 10700 }) });
  });
});

describe('cancelMyOrder', () => {
  test('maps "Paid orders cannot be self-cancelled..." to 400', async () => {
    orderService.cancelOrder = jest.fn().mockRejectedValue(new Error('Paid orders cannot be self-cancelled. Please raise a dispute.'));
    const req = { params: { orderId: ORDER_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await orderController.cancelMyOrder(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('calls orderService.cancelOrder with cancelledBy="patient"', async () => {
    orderService.cancelOrder = jest.fn().mockResolvedValue(makeOrder({ status: 'cancelled' }));
    const req = { params: { orderId: ORDER_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await orderController.cancelMyOrder(req, res, makeNext());
    expect(orderService.cancelOrder).toHaveBeenCalledWith(USER_ID, ORDER_ID, 'patient');
  });
});

describe('cancelVendorOrder', () => {
  test('calls orderService.cancelOrder with cancelledBy="vendor"', async () => {
    orderService.cancelOrder = jest.fn().mockResolvedValue(makeOrder({ status: 'cancelled' }));
    const req = { params: { orderId: ORDER_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await orderController.cancelVendorOrder(req, res, makeNext());
    expect(orderService.cancelOrder).toHaveBeenCalledWith(USER_ID, ORDER_ID, 'vendor');
  });
});

describe('completeOrder', () => {
  test('maps "Only processing orders..." to 400', async () => {
    orderService.completeOrder = jest.fn().mockRejectedValue(new Error('Only processing orders can be marked as completed'));
    const req = { params: { orderId: ORDER_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await orderController.completeOrder(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getVendorOrders / getMyOrders (list formatting)', () => {
  test('maps each order in the page through formatOrder', async () => {
    orderService.getVendorOrders = jest.fn().mockResolvedValue({ orders: [makeOrder(), makeOrder({ id: 'o2' })], total: 2, page: 1, limit: 20 });
    const req = { query: {}, user: { id: USER_ID } };
    const res = makeRes();
    await orderController.getVendorOrders(req, res, makeNext());
    const payload = res.json.mock.calls[0][0];
    expect(payload.orders).toHaveLength(2);
    expect(payload.orders[0]).toEqual(expect.objectContaining({ id: ORDER_ID }));
  });
});
