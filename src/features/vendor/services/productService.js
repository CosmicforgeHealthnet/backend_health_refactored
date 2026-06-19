const productRepository = require("../repositories/productRepository");
const vendorRepository  = require("../repositories/vendorRepository");
const { PRODUCT_CATEGORIES } = require("../constants/productCategories");

class ProductService {
    async createProduct(userId, data) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        if (vendor.verificationStatus !== "approved") {
            throw new Error("Your vendor account must be approved before listing products");
        }

        // Medications are restricted to pharmacies (hybrid or standard)
        if (data.category === "medications" && !vendor.isHybridPharmacy) {
            throw new Error("Only pharmacies can list medications");
        }

        const categoryDef = PRODUCT_CATEGORIES[data.category];
        if (!categoryDef) throw new Error("Invalid category");

        if (!categoryDef.subcategories.includes(data.subcategory)) {
            throw new Error(`Invalid subcategory for category "${data.category}". Valid options: ${categoryDef.subcategories.join(", ")}`);
        }

        const product = await productRepository.save({
            vendorId:             vendor.id,
            title:                data.title,
            description:          data.description,
            price:                data.price,
            stockQuantity:        data.stockQuantity ?? 0,
            category:             data.category,
            subcategory:          data.subcategory,
            prescriptionRequired: data.prescriptionRequired === true,
            status:               "pending",
            isActive:             true,
        });

        if (data.mediaUrls?.length) {
            await Promise.all(
                data.mediaUrls.map((item, index) =>
                    productRepository.saveMedia({
                        productId: product.id,
                        mediaUrl:  typeof item === "string" ? item : item.url,
                        mediaType: typeof item === "string" ? "image" : (item.type || "image"),
                        isPrimary: index === 0,
                    })
                )
            );
        }

        return product;
    }

    async uploadProductMedia(userId, productId, files) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const product = await productRepository.findByIdAndVendor(productId, vendor.id);
        if (!product) throw new Error("Product not found");

        const mediaItems = files.map((file, index) => ({
            productId,
            mediaUrl:  file.url || file.path,
            mediaType: file.mimetype?.startsWith("video/") ? "video" : "image",
            isPrimary: index === 0 && product.media?.length === 0,
        }));

        return Promise.all(mediaItems.map((m) => productRepository.saveMedia(m)));
    }

    async getVendorProducts(userId, { status, page, limit }) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        return productRepository.findByVendorPaginated({ vendorId: vendor.id, status, page, limit });
    }

    async getVendorProductById(userId, productId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const product = await productRepository.findByIdAndVendor(productId, vendor.id);
        if (!product) throw new Error("Product not found");

        return product;
    }

    async updateProduct(userId, productId, data) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const product = await productRepository.findByIdAndVendor(productId, vendor.id);
        if (!product) throw new Error("Product not found");

        const allowedFields = ["title", "description", "price", "stockQuantity", "isActive", "prescriptionRequired"];
        const updates = {};
        for (const field of allowedFields) {
            if (data[field] !== undefined) updates[field] = data[field];
        }

        // Any update resets status to pending for re-approval
        if (Object.keys(updates).length > 0) {
            updates.status = "pending";
        }

        await productRepository.update(productId, updates);
        return productRepository.findByIdAndVendor(productId, vendor.id);
    }

    async deleteProduct(userId, productId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const product = await productRepository.findByIdAndVendor(productId, vendor.id);
        if (!product) throw new Error("Product not found");

        await productRepository.delete(productId);
    }

    // ─── Admin operations ────────────────────────────────────────────────────

    async getAllProductsForAdmin({ status, category, page, limit }) {
        return productRepository.findAllForAdminPaginated({ status, category, page, limit });
    }

    async approveProduct(productId) {
        const product = await productRepository.findById(productId);
        if (!product) throw new Error("Product not found");

        await productRepository.update(productId, { status: "approved", rejectionReason: null });
        return productRepository.findById(productId);
    }

    async rejectProduct(productId, rejectionReason) {
        const product = await productRepository.findById(productId);
        if (!product) throw new Error("Product not found");

        if (!rejectionReason) throw new Error("rejectionReason is required when rejecting a product");

        await productRepository.update(productId, { status: "failed", rejectionReason });
        return productRepository.findById(productId);
    }
}

module.exports = new ProductService();
