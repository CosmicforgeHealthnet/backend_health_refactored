const axios                 = require("axios");
const promotionRepository   = require("../repositories/promotionRepository");
const vendorRepository      = require("../repositories/vendorRepository");
const productRepository     = require("../repositories/productRepository");
const userRepository        = require("../../auth/repositories/userRepository");
const NotificationService   = require("../../notifications/services/notificationService");
const {
    calculatePrice,
    calculateEndDate,
    PROMOTION_SUBTYPES,
    GET_SALES_MAX_PRODUCTS,
} = require("../constants/promotionPricing");

const notificationService = new NotificationService();

class PromotionService {

    // ─── Create ───────────────────────────────────────────────────────────────

    async createPromotion(userId, data) {
        const {
            type,
            subType,
            title,
            duration,
            customDays,
            termsAccepted,
            productIds,
            campaignProduct,
        } = data;

        if (!termsAccepted) throw new Error("You must accept the promotion policy terms");

        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");
        if (vendor.verificationStatus !== "approved") {
            throw new Error("Your vendor account must be approved to create promotions");
        }

        // Validate subType for non-campaign types
        if (type !== "campaign") {
            const validSubtypes = PROMOTION_SUBTYPES[type] || [];
            if (!validSubtypes.includes(subType)) {
                throw new Error(`Invalid subType for "${type}". Valid options: ${validSubtypes.join(", ")}`);
            }
        }

        const pricePaid = calculatePrice(duration, customDays);

        const promotion = await promotionRepository.save({
            vendorId:      vendor.id,
            type,
            subType:       subType || null,
            title,
            duration,
            customDays:    duration === "custom" ? customDays : null,
            status:        "pending",
            pricePaid,
            paymentStatus: "pending",
            termsAccepted: true,
        });

        // Save linked products for get_sales type
        if (type === "get_sales" && Array.isArray(productIds)) {
            if (productIds.length > GET_SALES_MAX_PRODUCTS) {
                throw new Error(`Maximum ${GET_SALES_MAX_PRODUCTS} products allowed per Get Sales promotion`);
            }
            // Verify all products belong to this vendor and are approved
            for (const productId of productIds) {
                const product = await productRepository.findByIdAndVendor(productId, vendor.id);
                if (!product || product.status !== "approved") {
                    throw new Error(`Product ${productId} is not available for promotion`);
                }
            }
            await promotionRepository.savePromotionProducts(
                productIds.map((productId) => ({ promotionId: promotion.id, productId }))
            );
        }

        // Save campaign product for campaign type
        if (type === "campaign" && campaignProduct) {
            await promotionRepository.saveCampaignProduct({
                promotionId:   promotion.id,
                title:         campaignProduct.title,
                category:      campaignProduct.category,
                description:   campaignProduct.description,
                price:         campaignProduct.price,
                stockQuantity: campaignProduct.stockQuantity || 0,
                mediaUrls:     campaignProduct.mediaUrls || [],
            });
        }

        return promotionRepository.findByIdAndVendor(promotion.id, vendor.id);
    }

    // ─── Initiate payment ─────────────────────────────────────────────────────

    async initiatePayment(userId, promotionId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const promotion = await promotionRepository.findByIdAndVendor(promotionId, vendor.id);
        if (!promotion) throw new Error("Promotion not found");
        if (promotion.paymentStatus === "paid") throw new Error("This promotion is already paid");

        const user      = await userRepository.findById(userId);
        const reference = `COSMIC-PROMO-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const amount    = Number(promotion.pricePaid);

        let authUrl;
        const provider = process.env.DEFAULT_PAYMENT_PROVIDER || "paystack";

        if (provider === "flutterwave") {
            const response = await axios.post(
                "https://api.flutterwave.com/v3/payments",
                {
                    tx_ref:       reference,
                    amount,
                    currency:     "NGN",
                    redirect_url: process.env.PAYMENT_CALLBACK_URL,
                    customer:     { email: user.email, name: user.fullName },
                    meta:         { promotionId: promotion.id, vendorId: vendor.id },
                },
                { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
            );
            authUrl = response.data.data.link;
        } else {
            const response = await axios.post(
                "https://api.paystack.co/transaction/initialize",
                {
                    email:        user.email,
                    amount:       Math.round(amount * 100),
                    currency:     "NGN",
                    reference,
                    metadata:     { promotionId: promotion.id, vendorId: vendor.id },
                    callback_url: process.env.PAYMENT_CALLBACK_URL,
                },
                { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
            );
            authUrl = response.data.data.authorization_url;
        }

        await promotionRepository.update(promotion.id, {
            paymentReference: reference,
            paymentAuthUrl:   authUrl,
            paymentProvider:  provider,
        });

        return { paymentUrl: authUrl, reference, amount };
    }

    // ─── Activate (called from webhook) ──────────────────────────────────────

    async activatePromotion(paymentReference) {
        const promotion = await promotionRepository.findByReference(paymentReference);
        if (!promotion) throw new Error("Promotion not found for this payment reference");
        if (promotion.paymentStatus === "paid") return promotion; // idempotent

        const now     = new Date();
        const endDate = calculateEndDate(now, promotion.duration, promotion.customDays);

        await promotionRepository.update(promotion.id, {
            paymentStatus: "paid",
            status:        "active",
            startDate:     now,
            endDate,
        });

        try {
            await notificationService.createNotification(
                promotion.vendorId,
                "success",
                `Your "${promotion.title}" promotion is now active and running until ${endDate.toDateString()}.`,
                { promotionId: promotion.id }
            );
        } catch { /* non-critical */ }

        return promotionRepository.findById(promotion.id);
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    async getMyPromotions(userId, { type, status, page, limit }) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        // Auto-complete expired promotions on read
        await this._expireOldPromotions(vendor.id);

        return promotionRepository.findByVendorPaginated({
            vendorId: vendor.id,
            type, status,
            page:  Number(page  || 1),
            limit: Number(limit || 20),
        });
    }

    async getMyPromotionById(userId, promotionId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const promotion = await promotionRepository.findByIdAndVendor(promotionId, vendor.id);
        if (!promotion) throw new Error("Promotion not found");
        return promotion;
    }

    async getTrends(userId, days = 30) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const [trends, active] = await Promise.all([
            promotionRepository.getTrendsByVendor(vendor.id, Number(days)),
            promotionRepository.getActiveByVendor(vendor.id),
        ]);

        return {
            trends,
            activePromotions: active.length,
            activeDetails:    active.map(formatPromoSummary),
        };
    }

    // ─── Update ───────────────────────────────────────────────────────────────

    async updatePromotion(userId, promotionId, data) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const promotion = await promotionRepository.findByIdAndVendor(promotionId, vendor.id);
        if (!promotion) throw new Error("Promotion not found");
        if (promotion.status !== "pending") throw new Error("Only pending promotions can be edited");

        const allowed = ["title", "subType", "duration", "customDays"];
        const updates = {};
        for (const field of allowed) {
            if (data[field] !== undefined) updates[field] = data[field];
        }

        // Recalculate price if duration changed
        if (updates.duration || updates.customDays) {
            const duration   = updates.duration   || promotion.duration;
            const customDays = updates.customDays || promotion.customDays;
            updates.pricePaid = calculatePrice(duration, customDays);
        }

        await promotionRepository.update(promotionId, updates);
        return promotionRepository.findByIdAndVendor(promotionId, vendor.id);
    }

    // ─── Cancel / Delete ──────────────────────────────────────────────────────

    async cancelPromotion(userId, promotionId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const promotion = await promotionRepository.findByIdAndVendor(promotionId, vendor.id);
        if (!promotion) throw new Error("Promotion not found");
        if (!["pending", "active"].includes(promotion.status)) {
            throw new Error("Only pending or active promotions can be cancelled");
        }

        await promotionRepository.update(promotionId, { status: "cancelled" });
        return promotionRepository.findByIdAndVendor(promotionId, vendor.id);
    }

    async deletePromotion(userId, promotionId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const promotion = await promotionRepository.findByIdAndVendor(promotionId, vendor.id);
        if (!promotion) throw new Error("Promotion not found");
        if (promotion.status !== "pending") throw new Error("Only pending promotions can be deleted");

        await promotionRepository.delete(promotionId);
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    async _expireOldPromotions(vendorId) {
        const active = await promotionRepository.getActiveByVendor(vendorId);
        const now    = new Date();
        const expired = active.filter((p) => p.endDate && new Date(p.endDate) < now);
        await Promise.all(
            expired.map((p) => promotionRepository.update(p.id, { status: "completed" }))
        );
    }
}

function formatPromoSummary(p) {
    return { id: p.id, title: p.title, type: p.type, status: p.status, endDate: p.endDate };
}

module.exports = new PromotionService();
