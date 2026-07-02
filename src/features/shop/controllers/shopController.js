const shopService = require("../services/shopService");

class ShopController {
    getCategories(req, res) {
        const categories = shopService.getCategories();
        return res.status(200).json({ success: true, categories });
    }

    getSubcategories(req, res, next) {
        try {
            const subcategories = shopService.getSubcategories(req.params.category);
            return res.status(200).json({ success: true, subcategories });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async browseProducts(req, res, next) {
        try {
            const { category, subcategory, vendorId, minPrice, maxPrice, search, sortBy, page, limit } = req.query;

            const result = await shopService.browseProducts({
                category, subcategory, vendorId, minPrice, maxPrice, search, sortBy, page, limit,
            });

            return res.status(200).json({
                success: true,
                ...result,
                products: result.products.map(formatPublicProduct),
            });
        } catch (error) {
            next(error);
        }
    }

    async getProductById(req, res, next) {
        try {
            const product = await shopService.getProductById(req.params.id);
            return res.status(200).json({ success: true, product: formatPublicProduct(product) });
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    async getVendorInfo(req, res, next) {
        try {
            const vendor = await shopService.getVendorInfo(req.params.vendorId);
            return res.status(200).json({
                success: true,
                vendor: {
                    id:                  vendor.id,
                    businessName:        vendor.businessName,
                    businessCategory:    vendor.businessCategory,
                    businessDescription: vendor.businessDescription,
                    logoUrl:             vendor.logoUrl,
                    city:                vendor.city,
                    state:               vendor.state,
                    country:             vendor.country,
                },
            });
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }
}

function formatPublicProduct(p) {
    return {
        id:                   p.id,
        title:                p.title,
        description:          p.description,
        price:                p.price,
        stockQuantity:        p.stockQuantity,
        inStock:              p.stockQuantity > 0,
        category:             p.category,
        subcategory:          p.subcategory,
        prescriptionRequired: p.prescriptionRequired ?? false,
        media:                p.media || [],
        vendor: p.vendor
            ? {
                id:           p.vendor.id,
                businessName: p.vendor.businessName,
                logoUrl:      p.vendor.logoUrl,
                city:         p.vendor.city,
                state:        p.vendor.state,
              }
            : undefined,
        createdAt: p.createdAt,
    };
}

module.exports = new ShopController();
