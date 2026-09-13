/* eslint-env jest */
// Light-pass unit tests for vendor PromotionController — promotionService is
// fully covered separately; this checks request validation and error mapping.

jest.mock('../../services/promotionService');
const promotionService = require('../../services/promotionService');

const promotionController = require('../promotionController');

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const PROMOTION_ID = 'bbbb0000-0000-0000-0000-000000000002';

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

describe('createPromotion', () => {
  test('400s when type/title/duration missing', async () => {
    const req = { body: {}, user: { id: USER_ID } };
    const res = makeRes();
    await promotionController.createPromotion(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(promotionService.createPromotion).not.toHaveBeenCalled();
  });

  test('400s on an invalid type', async () => {
    const req = { body: { type: 'not_real', title: 'x', duration: 'one_day' }, user: { id: USER_ID } };
    const res = makeRes();
    await promotionController.createPromotion(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400s on an invalid duration', async () => {
    const req = { body: { type: 'boost_account', title: 'x', duration: 'one_year' }, user: { id: USER_ID } };
    const res = makeRes();
    await promotionController.createPromotion(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400s when duration=custom but customDays is missing/invalid', async () => {
    const req = { body: { type: 'boost_account', title: 'x', duration: 'custom', customDays: 0 }, user: { id: USER_ID } };
    const res = makeRes();
    await promotionController.createPromotion(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(promotionService.createPromotion).not.toHaveBeenCalled();
  });

  test('201s on success', async () => {
    promotionService.createPromotion = jest.fn().mockResolvedValue({ id: PROMOTION_ID, title: 'x', promotionProducts: [] });
    const req = { body: { type: 'boost_account', title: 'x', duration: 'one_day', termsAccepted: true }, user: { id: USER_ID } };
    const res = makeRes();
    await promotionController.createPromotion(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('maps a service validation error ("Maximum ...") to 400', async () => {
    promotionService.createPromotion = jest.fn().mockRejectedValue(new Error('Maximum 5 products allowed per Get Sales promotion'));
    const req = { body: { type: 'get_sales', title: 'x', duration: 'one_day' }, user: { id: USER_ID } };
    const res = makeRes();
    await promotionController.createPromotion(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getMyPromotionById', () => {
  test('maps "Promotion not found" to 404', async () => {
    promotionService.getMyPromotionById = jest.fn().mockRejectedValue(new Error('Promotion not found'));
    const req = { params: { id: PROMOTION_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await promotionController.getMyPromotionById(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('updatePromotion / cancelPromotion / deletePromotion', () => {
  test('updatePromotion maps "Only pending promotions can be edited" to 400', async () => {
    promotionService.updatePromotion = jest.fn().mockRejectedValue(new Error('Only pending promotions can be edited'));
    const req = { params: { id: PROMOTION_ID }, body: {}, user: { id: USER_ID } };
    const res = makeRes();
    await promotionController.updatePromotion(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('cancelPromotion succeeds and returns the formatted promotion', async () => {
    promotionService.cancelPromotion = jest.fn().mockResolvedValue({ id: PROMOTION_ID, status: 'cancelled', promotionProducts: [] });
    const req = { params: { id: PROMOTION_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await promotionController.cancelPromotion(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('deletePromotion maps "Only pending promotions can be deleted" to 400', async () => {
    promotionService.deletePromotion = jest.fn().mockRejectedValue(new Error('Only pending promotions can be deleted'));
    const req = { params: { id: PROMOTION_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await promotionController.deletePromotion(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getPricingInfo', () => {
  test('returns the documented static pricing/types payload', () => {
    const res = makeRes();
    promotionController.getPricingInfo({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.pricing.one_day.price).toBe(5000);
    expect(payload.currency).toBe('NGN');
  });
});
