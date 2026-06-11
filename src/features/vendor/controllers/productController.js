const productService = require("../services/productService");
const { ALL_CATEGORY_KEYS, ALL_SUBCATEGORY_KEYS } = require("../constants/productCategories");

class ProductController {
    async createProduct(req, res, next) {
        try {
            const { title, description, price, stockQuantity, category, subcategory, prescriptionRequired, mediaUrls } = req.body;

            if (!title || !description || price === undefined || !category || !subcategory) {
                return res.status(400).json({
                    success: false,
                    error: "Missing required fields: title, description, price, category, subcategory",
                });
            }
            if (!ALL_CATEGORY_KEYS.includes(category)) {
                return res.status(400).json({ success: false, error: `Invalid category. Must be one of: ${ALL_CATEGORY_KEYS.join(", ")}` });
            }

            const product = await productService.createProduct(req.user.id, {
                title, description, price, stockQuantity, category, subcategory, prescriptionRequired,
                mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : undefined,
            });

            return res.status(201).json({
                success: true,
                message: "Product submitted for admin approval",
                product: formatProduct(product),
            });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async uploadStandaloneMedia(req, res, next) {
        try {
            const savedFiles = req.savedFiles || [];
            if (!savedFiles.length) {
                return res.status(400).json({ success: false, error: "No media files uploaded" });
            }

            const baseUrl = process.env.FILE_SERVER_URL || process.env.APP_URL || "";
            const media = savedFiles.map((f) => ({
                url:      `${baseUrl}/api/documents/images/${f.id}`,
                mimeType: f.mimeType,
                type:     f.mimeType?.startsWith("video/") ? "video" : "image",
            }));

            return res.status(200).json({
                success: true,
                message: "Media uploaded. Pass the urls in mediaUrls when creating your product.",
                media,
            });
        } catch (error) {
            next(error);
        }
    }

    async uploadProductMedia(req, res, next) {
        try {
            const savedFiles = req.savedFiles || [];
            if (!savedFiles.length) {
                return res.status(400).json({ success: false, error: "No media files uploaded" });
            }

            const baseUrl = process.env.FILE_SERVER_URL || process.env.APP_URL || "";
            const files = savedFiles.map((f) => ({
                url:      `${baseUrl}/api/documents/images/${f.id}`,
                mimetype: f.mimeType,
            }));

            const media = await productService.uploadProductMedia(req.user.id, req.params.id, files);
            return res.status(200).json({ success: true, message: "Media uploaded", media });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async getMyProducts(req, res, next) {
        try {
            const { status, page = 1, limit = 20 } = req.query;
            const result = await productService.getVendorProducts(req.user.id, {
                status,
                page: Number(page),
                limit: Number(limit),
            });

            return res.status(200).json({
                success: true,
                ...result,
                products: result.products.map(formatProduct),
            });
        } catch (error) {
            next(error);
        }
    }

    async getMyProductById(req, res, next) {
        try {
            const product = await productService.getVendorProductById(req.user.id, req.params.id);
            return res.status(200).json({ success: true, product: formatProduct(product) });
        } catch (error) {
            if (isClientError(error)) return res.status(404).json({ success: false, error: error.message });
            next(error);
        }
    }

    async updateProduct(req, res, next) {
        try {
            const updated = await productService.updateProduct(req.user.id, req.params.id, req.body);
            return res.status(200).json({
                success: true,
                message: "Product updated and resubmitted for approval",
                product: formatProduct(updated),
            });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async deleteProduct(req, res, next) {
        try {
            await productService.deleteProduct(req.user.id, req.params.id);
            return res.status(200).json({ success: true, message: "Product deleted" });
        } catch (error) {
            if (isClientError(error)) return res.status(404).json({ success: false, error: error.message });
            next(error);
        }
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    async adminGetAllProducts(req, res, next) {
        try {
            const { status, category, page = 1, limit = 20 } = req.query;
            const result = await productService.getAllProductsForAdmin({
                status, category, page: Number(page), limit: Number(limit),
            });
            return res.status(200).json({ success: true, ...result, products: result.products.map(formatProduct) });
        } catch (error) {
            next(error);
        }
    }

    async adminApproveProduct(req, res, next) {
        try {
            const product = await productService.approveProduct(req.params.id);
            return res.status(200).json({ success: true, message: "Product approved", product: formatProduct(product) });
        } catch (error) {
            if (isClientError(error)) return res.status(404).json({ success: false, error: error.message });
            next(error);
        }
    }

    async adminRejectProduct(req, res, next) {
        try {
            const { rejectionReason } = req.body;
            const product = await productService.rejectProduct(req.params.id, rejectionReason);
            return res.status(200).json({ success: true, message: "Product rejected", product: formatProduct(product) });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }
}

function formatProduct(p) {
    return {
        id:                   p.id,
        title:                p.title,
        description:          p.description,
        price:                p.price,
        stockQuantity:        p.stockQuantity,
        category:             p.category,
        subcategory:          p.subcategory,
        prescriptionRequired: p.prescriptionRequired ?? false,
        status:               p.status,
        rejectionReason:      p.rejectionReason,
        isActive:             p.isActive,
        media:                p.media || [],
        vendor:               p.vendor ? { id: p.vendor.id, businessName: p.vendor.businessName, logoUrl: p.vendor.logoUrl } : undefined,
        createdAt:            p.createdAt,
        updatedAt:            p.updatedAt,
    };
}

function isClientError(error) {
    return (
        error.message.includes("not found") ||
        error.message.includes("Invalid") ||
        error.message.includes("must be") ||
        error.message.includes("Only") ||
        error.message.includes("required") ||
        error.message.includes("approved")
    );
}

module.exports = new ProductController();
