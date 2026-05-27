const productRepository  = require("../../vendor/repositories/productRepository");
const vendorRepository   = require("../../vendor/repositories/vendorRepository");
const { PRODUCT_CATEGORIES, ALL_CATEGORY_KEYS } = require("../../vendor/constants/productCategories");

class ShopService {
    getCategories() {
        return ALL_CATEGORY_KEYS.map((key) => ({
            key,
            label:        PRODUCT_CATEGORIES[key].label,
            subcategories: PRODUCT_CATEGORIES[key].subcategories,
            // Hide medications from public listing — only shown to authenticated patients
            ...(PRODUCT_CATEGORIES[key].hybridPharmacyOnly ? { restricted: true } : {}),
        }));
    }

    getSubcategories(category) {
        const def = PRODUCT_CATEGORIES[category];
        if (!def) throw new Error(`Invalid category: ${category}`);
        return def.subcategories.map((key) => ({ key, category }));
    }

    async browseProducts({ category, subcategory, vendorId, minPrice, maxPrice, search, sortBy, page, limit }) {
        return productRepository.findApprovedPaginated({
            category, subcategory, vendorId, minPrice, maxPrice, search, sortBy,
            page:  Number(page  || 1),
            limit: Number(limit || 20),
        });
    }

    async getProductById(productId) {
        const product = await productRepository.findById(productId);
        if (!product || product.status !== "approved" || !product.isActive) {
            throw new Error("Product not found");
        }
        return product;
    }

    async getVendorInfo(vendorId) {
        const vendor = await vendorRepository.findById(vendorId);
        if (!vendor || vendor.verificationStatus !== "approved") {
            throw new Error("Vendor not found");
        }
        return vendor;
    }
}

module.exports = new ShopService();
