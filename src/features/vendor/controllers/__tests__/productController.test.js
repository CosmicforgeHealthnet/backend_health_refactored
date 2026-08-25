/* eslint-env jest */
// Light-pass unit tests for vendor ProductController — productService is
// fully covered separately; this checks request validation, category
// whitelist enforcement, and isClientError() status-code mapping.

jest.mock('../../services/productService');
const productService = require('../../services/productService');

const productController = require('../productController');

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const PRODUCT_ID = 'bbbb0000-0000-0000-0000-000000000002';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
function makeNext() { return jest.fn(); }

const VALID_BODY = {
  title: 'x', description: 'd', price: 100, category: 'health_wellness', subcategory: 'skincare_beauty',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createProduct', () => {
  test('400s when a required field is missing', async () => {
    const req = { body: { ...VALID_BODY, title: undefined }, user: { id: USER_ID } };
    const res = makeRes();
    await productController.createProduct(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(productService.createProduct).not.toHaveBeenCalled();
  });

  test('400s on an unknown category before even calling the service', async () => {
    const req = { body: { ...VALID_BODY, category: 'not_real' }, user: { id: USER_ID } };
    const res = makeRes();
    await productController.createProduct(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(productService.createProduct).not.toHaveBeenCalled();
  });

  test('maps "Only pharmacies can list medications" to 400', async () => {
    productService.createProduct = jest.fn().mockRejectedValue(new Error('Only pharmacies can list medications'));
    const req = { body: { ...VALID_BODY, category: 'medications', subcategory: 'over_the_counter' }, user: { id: USER_ID } };
    const res = makeRes();
    await productController.createProduct(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('201s with the created product on success', async () => {
    productService.createProduct = jest.fn().mockResolvedValue({ id: PRODUCT_ID, ...VALID_BODY, status: 'pending', media: [] });
    const req = { body: VALID_BODY, user: { id: USER_ID } };
    const res = makeRes();
    await productController.createProduct(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, product: expect.objectContaining({ id: PRODUCT_ID }) }));
  });
});

describe('getMyProductById', () => {
  test('maps "Product not found" to 404', async () => {
    productService.getVendorProductById = jest.fn().mockRejectedValue(new Error('Product not found'));
    const req = { params: { id: PRODUCT_ID }, user: { id: USER_ID } };
    const res = makeRes();
    await productController.getMyProductById(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('updateProduct', () => {
  test('maps "Invalid ..." errors to 400', async () => {
    productService.updateProduct = jest.fn().mockRejectedValue(new Error('Invalid category'));
    const req = { params: { id: PRODUCT_ID }, body: {}, user: { id: USER_ID } };
    const res = makeRes();
    await productController.updateProduct(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('forwards an unexpected error to next()', async () => {
    productService.updateProduct = jest.fn().mockRejectedValue(new Error('kaboom'));
    const req = { params: { id: PRODUCT_ID }, body: {}, user: { id: USER_ID } };
    const res = makeRes();
    const next = makeNext();
    await productController.updateProduct(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('adminApproveProduct / adminRejectProduct', () => {
  test('adminApproveProduct maps "not found" to 404', async () => {
    productService.approveProduct = jest.fn().mockRejectedValue(new Error('Product not found'));
    const req = { params: { id: PRODUCT_ID } };
    const res = makeRes();
    await productController.adminApproveProduct(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('adminRejectProduct maps a missing-reason error to 400', async () => {
    productService.rejectProduct = jest.fn().mockRejectedValue(new Error('rejectionReason is required when rejecting a product'));
    const req = { params: { id: PRODUCT_ID }, body: {} };
    const res = makeRes();
    await productController.adminRejectProduct(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('adminRejectProduct succeeds with a reason', async () => {
    productService.rejectProduct = jest.fn().mockResolvedValue({ id: PRODUCT_ID, status: 'failed', rejectionReason: 'bad', media: [] });
    const req = { params: { id: PRODUCT_ID }, body: { rejectionReason: 'bad' } };
    const res = makeRes();
    await productController.adminRejectProduct(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('uploadStandaloneMedia / uploadProductMedia', () => {
  test('uploadStandaloneMedia 400s when no files were saved', async () => {
    const req = { savedFiles: [] };
    const res = makeRes();
    await productController.uploadStandaloneMedia(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('uploadProductMedia 400s when no files were saved', async () => {
    const req = { savedFiles: [], params: { id: PRODUCT_ID } };
    const res = makeRes();
    await productController.uploadProductMedia(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
