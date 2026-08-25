/* eslint-env jest */
// Unit tests for vendor ProductService — listing gates (approved vendor,
// medications restricted to hybrid pharmacies), category/subcategory
// validation, and the stock/status fields that matter for correctness.

jest.mock('../../repositories/productRepository');
jest.mock('../../repositories/vendorRepository');

const productRepository = require('../../repositories/productRepository');
const vendorRepository = require('../../repositories/vendorRepository');

const productService = require('../productService');

const VENDOR_USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VENDOR_ID = 'bbbb0000-0000-0000-0000-000000000002';
const PRODUCT_ID = 'cccc0000-0000-0000-0000-000000000003';

function makeVendor(overrides = {}) {
  return {
    id: VENDOR_ID,
    userId: VENDOR_USER_ID,
    verificationStatus: 'approved',
    isHybridPharmacy: false,
    ...overrides,
  };
}

function makeProduct(overrides = {}) {
  return {
    id: PRODUCT_ID,
    vendorId: VENDOR_ID,
    title: 'Vitamin C',
    stockQuantity: 10,
    category: 'nutrition_healthy_living',
    subcategory: 'vitamins_supplements',
    status: 'approved',
    media: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  vendorRepository.findByUserId = jest.fn().mockResolvedValue(makeVendor());

  productRepository.save = jest.fn().mockImplementation((data) => Promise.resolve({ id: PRODUCT_ID, ...data }));
  productRepository.saveMedia = jest.fn().mockResolvedValue(undefined);
  productRepository.findByIdAndVendor = jest.fn().mockResolvedValue(makeProduct());
  productRepository.findById = jest.fn().mockResolvedValue(makeProduct());
  productRepository.findOutOfStockByVendor = jest.fn().mockResolvedValue({ products: [], total: 0 });
  productRepository.findByVendorPaginated = jest.fn().mockResolvedValue({ products: [], total: 0, page: 1, limit: 20 });
  productRepository.findAllForAdminPaginated = jest.fn().mockResolvedValue({ products: [], total: 0, page: 1, limit: 20 });
  productRepository.update = jest.fn().mockResolvedValue(undefined);
  productRepository.delete = jest.fn().mockResolvedValue(undefined);
});

// ============================================================================
// SUITE 1 - createProduct: approval gate, medications restriction, category validation
// ============================================================================

describe('createProduct', () => {
  test('throws when caller has no vendor profile', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(productService.createProduct(VENDOR_USER_ID, {})).rejects.toThrow('Vendor profile not found');
  });

  test('throws when vendor is not yet approved', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(makeVendor({ verificationStatus: 'pending' }));
    await expect(
      productService.createProduct(VENDOR_USER_ID, { category: 'others', subcategory: 'health_gadgets_devices' })
    ).rejects.toThrow('Your vendor account must be approved before listing products');
    expect(productRepository.save).not.toHaveBeenCalled();
  });

  test('throws when a non-hybrid-pharmacy vendor tries to list medications', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(makeVendor({ isHybridPharmacy: false }));
    await expect(
      productService.createProduct(VENDOR_USER_ID, { category: 'medications', subcategory: 'over_the_counter' })
    ).rejects.toThrow('Only pharmacies can list medications');
  });

  test('allows a hybrid pharmacy vendor to list medications', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(makeVendor({ isHybridPharmacy: true }));
    await expect(
      productService.createProduct(VENDOR_USER_ID, {
        title: 'Paracetamol', description: 'Pain relief', price: 500,
        category: 'medications', subcategory: 'over_the_counter',
      })
    ).resolves.toBeDefined();
  });

  test('throws on an unknown category', async () => {
    await expect(
      productService.createProduct(VENDOR_USER_ID, { category: 'not_a_real_category', subcategory: 'x' })
    ).rejects.toThrow('Invalid category');
  });

  test('throws when subcategory does not belong to the category', async () => {
    await expect(
      productService.createProduct(VENDOR_USER_ID, { category: 'others', subcategory: 'vitamins_supplements' })
    ).rejects.toThrow(/Invalid subcategory for category "others"/);
  });

  test('creates the product as pending/active with stockQuantity defaulted to 0 when omitted', async () => {
    const product = await productService.createProduct(VENDOR_USER_ID, {
      title: 'Face Cream', description: 'Moisturizer', price: 2500,
      category: 'health_wellness', subcategory: 'skincare_beauty',
    });

    expect(productRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        vendorId: VENDOR_ID,
        stockQuantity: 0,
        status: 'pending',
        isActive: true,
        prescriptionRequired: false,
      })
    );
    expect(product.id).toBe(PRODUCT_ID);
  });

  test('preserves an explicit stockQuantity of 0 (does not treat it as "missing")', async () => {
    await productService.createProduct(VENDOR_USER_ID, {
      title: 'Sold out item', description: 'd', price: 100, stockQuantity: 0,
      category: 'health_wellness', subcategory: 'skincare_beauty',
    });
    expect(productRepository.save).toHaveBeenCalledWith(expect.objectContaining({ stockQuantity: 0 }));
  });

  test('coerces prescriptionRequired to a strict boolean', async () => {
    await productService.createProduct(VENDOR_USER_ID, {
      title: 'x', description: 'd', price: 100, prescriptionRequired: 'yes',
      category: 'health_wellness', subcategory: 'skincare_beauty',
    });
    expect(productRepository.save).toHaveBeenCalledWith(expect.objectContaining({ prescriptionRequired: false }));
  });

  test('saves media with the first item flagged isPrimary', async () => {
    await productService.createProduct(VENDOR_USER_ID, {
      title: 'x', description: 'd', price: 100,
      category: 'health_wellness', subcategory: 'skincare_beauty',
      mediaUrls: ['http://a.jpg', { url: 'http://b.mp4', type: 'video' }],
    });

    expect(productRepository.saveMedia).toHaveBeenNthCalledWith(1, expect.objectContaining({
      mediaUrl: 'http://a.jpg', mediaType: 'image', isPrimary: true,
    }));
    expect(productRepository.saveMedia).toHaveBeenNthCalledWith(2, expect.objectContaining({
      mediaUrl: 'http://b.mp4', mediaType: 'video', isPrimary: false,
    }));
  });
});

// ============================================================================
// SUITE 2 - updateProduct: allowed fields + status reset to pending
// ============================================================================

describe('updateProduct', () => {
  test('throws when product does not belong to this vendor', async () => {
    productRepository.findByIdAndVendor = jest.fn().mockResolvedValue(null);
    await expect(productService.updateProduct(VENDOR_USER_ID, PRODUCT_ID, { title: 'x' })).rejects.toThrow('Product not found');
  });

  test('only whitelisted fields are forwarded to the repository', async () => {
    await productService.updateProduct(VENDOR_USER_ID, PRODUCT_ID, {
      title: 'New title', vendorId: 'attacker-controlled-vendor', status: 'approved', id: 'other-id',
    });

    const updateArg = productRepository.update.mock.calls[0][1];
    expect(updateArg).toEqual({ title: 'New title', status: 'pending' });
    expect(updateArg.vendorId).toBeUndefined();
    expect(updateArg.id).toBeUndefined();
  });

  test('any field update resets status to pending for re-approval', async () => {
    await productService.updateProduct(VENDOR_USER_ID, PRODUCT_ID, { stockQuantity: 50 });
    expect(productRepository.update).toHaveBeenCalledWith(PRODUCT_ID, { stockQuantity: 50, status: 'pending' });
  });

  test('an empty update payload does not force a status change', async () => {
    await productService.updateProduct(VENDOR_USER_ID, PRODUCT_ID, {});
    expect(productRepository.update).toHaveBeenCalledWith(PRODUCT_ID, {});
  });
});

// ============================================================================
// SUITE 3 - deleteProduct / getVendorProductById guards
// ============================================================================

describe('deleteProduct', () => {
  test('throws when product does not belong to this vendor', async () => {
    productRepository.findByIdAndVendor = jest.fn().mockResolvedValue(null);
    await expect(productService.deleteProduct(VENDOR_USER_ID, PRODUCT_ID)).rejects.toThrow('Product not found');
    expect(productRepository.delete).not.toHaveBeenCalled();
  });

  test('deletes when the product belongs to this vendor', async () => {
    await productService.deleteProduct(VENDOR_USER_ID, PRODUCT_ID);
    expect(productRepository.delete).toHaveBeenCalledWith(PRODUCT_ID);
  });
});

// ============================================================================
// SUITE 4 - Admin: approve/reject
// ============================================================================

describe('approveProduct / rejectProduct', () => {
  test('approveProduct throws when product does not exist', async () => {
    productRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(productService.approveProduct(PRODUCT_ID)).rejects.toThrow('Product not found');
  });

  test('approveProduct clears any prior rejection reason', async () => {
    await productService.approveProduct(PRODUCT_ID);
    expect(productRepository.update).toHaveBeenCalledWith(PRODUCT_ID, { status: 'approved', rejectionReason: null });
  });

  test('rejectProduct requires a rejectionReason', async () => {
    await expect(productService.rejectProduct(PRODUCT_ID, '')).rejects.toThrow(
      'rejectionReason is required when rejecting a product'
    );
    expect(productRepository.update).not.toHaveBeenCalled();
  });

  test('rejectProduct throws when product does not exist', async () => {
    productRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(productService.rejectProduct(PRODUCT_ID, 'bad photos')).rejects.toThrow('Product not found');
  });

  test('rejectProduct sets status failed with the given reason', async () => {
    await productService.rejectProduct(PRODUCT_ID, 'bad photos');
    expect(productRepository.update).toHaveBeenCalledWith(PRODUCT_ID, { status: 'failed', rejectionReason: 'bad photos' });
  });
});

// ============================================================================
// SUITE 5 - uploadProductMedia: isPrimary logic
// ============================================================================

describe('uploadProductMedia', () => {
  test('throws when product does not belong to this vendor', async () => {
    productRepository.findByIdAndVendor = jest.fn().mockResolvedValue(null);
    await expect(productService.uploadProductMedia(VENDOR_USER_ID, PRODUCT_ID, [])).rejects.toThrow('Product not found');
  });

  test('marks the first uploaded file as primary only if the product currently has no media', async () => {
    productRepository.findByIdAndVendor = jest.fn().mockResolvedValue(makeProduct({ media: [] }));
    await productService.uploadProductMedia(VENDOR_USER_ID, PRODUCT_ID, [
      { url: 'http://a.jpg', mimetype: 'image/jpeg' },
      { url: 'http://b.jpg', mimetype: 'image/jpeg' },
    ]);

    expect(productRepository.saveMedia).toHaveBeenNthCalledWith(1, expect.objectContaining({ isPrimary: true }));
    expect(productRepository.saveMedia).toHaveBeenNthCalledWith(2, expect.objectContaining({ isPrimary: false }));
  });

  test('does not mark anything primary when the product already has media', async () => {
    productRepository.findByIdAndVendor = jest.fn().mockResolvedValue(makeProduct({ media: [{ id: 'existing' }] }));
    await productService.uploadProductMedia(VENDOR_USER_ID, PRODUCT_ID, [
      { url: 'http://a.jpg', mimetype: 'image/jpeg' },
    ]);
    expect(productRepository.saveMedia).toHaveBeenCalledWith(expect.objectContaining({ isPrimary: false }));
  });

  test('classifies video mimetypes correctly', async () => {
    productRepository.findByIdAndVendor = jest.fn().mockResolvedValue(makeProduct({ media: [{ id: 'existing' }] }));
    await productService.uploadProductMedia(VENDOR_USER_ID, PRODUCT_ID, [
      { url: 'http://a.mp4', mimetype: 'video/mp4' },
    ]);
    expect(productRepository.saveMedia).toHaveBeenCalledWith(expect.objectContaining({ mediaType: 'video' }));
  });
});
