const promotionService = require("../services/promotionService");
const { PROMOTION_SUBTYPES, PROMOTION_PRICING } = require("../constants/promotionPricing");

const VALID_TYPES     = ["boost_account", "get_sales", "campaign"];
const VALID_DURATIONS = ["one_day", "one_week", "one_month", "custom"];

class PromotionController {
    async createPromotion(req, res, next) {
        try {
            const {
                type, subType, title, duration, customDays,
                termsAccepted, productIds, campaignProduct,
            } = req.body;

            if (!type || !title || !duration) {
                return res.status(400).json({ success: false, error: "type, title and duration are required" });
            }
            if (!VALID_TYPES.includes(type)) {
                return res.status(400).json({ success: false, error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` });
            }
            if (!VALID_DURATIONS.includes(duration)) {
                return res.status(400).json({ success: false, error: `Invalid duration. Must be one of: ${VALID_DURATIONS.join(", ")}` });
            }
            if (duration === "custom" && (!customDays || customDays < 1)) {
                return res.status(400).json({ success: false, error: "customDays is required and must be at least 1 when duration is custom" });
            }

            const promotion = await promotionService.createPromotion(req.user.id, {
                type, subType, title, duration, customDays,
                termsAccepted, productIds, campaignProduct,
            });

            return res.status(201).json({
                success: true,
                message: "Promotion created. Proceed to payment to activate it.",
                promotion: formatPromotion(promotion),
            });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async initiatePayment(req, res, next) {
        try {
            const result = await promotionService.initiatePayment(req.user.id, req.params.id);
            return res.status(200).json({
                success: true,
                message: "Proceed to the payment URL to activate your promotion",
                ...result,
            });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async getMyPromotions(req, res, next) {
        try {
            const { type, status, page, limit } = req.query;
            const result = await promotionService.getMyPromotions(req.user.id, { type, status, page, limit });
            return res.status(200).json({
                success: true,
                ...result,
                promotions: result.promotions.map(formatPromotion),
            });
        } catch (error) {
            next(error);
        }
    }

    async getMyPromotionById(req, res, next) {
        try {
            const promotion = await promotionService.getMyPromotionById(req.user.id, req.params.id);
            return res.status(200).json({ success: true, promotion: formatPromotion(promotion) });
        } catch (error) {
            if (isClientError(error)) return res.status(404).json({ success: false, error: error.message });
            next(error);
        }
    }

    async updatePromotion(req, res, next) {
        try {
            const promotion = await promotionService.updatePromotion(req.user.id, req.params.id, req.body);
            return res.status(200).json({ success: true, message: "Promotion updated", promotion: formatPromotion(promotion) });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async cancelPromotion(req, res, next) {
        try {
            const promotion = await promotionService.cancelPromotion(req.user.id, req.params.id);
            return res.status(200).json({ success: true, message: "Promotion cancelled", promotion: formatPromotion(promotion) });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async deletePromotion(req, res, next) {
        try {
            await promotionService.deletePromotion(req.user.id, req.params.id);
            return res.status(200).json({ success: true, message: "Promotion deleted" });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async getTrends(req, res, next) {
        try {
            const { days } = req.query;
            const result = await promotionService.getTrends(req.user.id, days);
            return res.status(200).json({ success: true, ...result });
        } catch (error) {
            next(error);
        }
    }

    getPricingInfo(req, res) {
        return res.status(200).json({
            success: true,
            pricing: {
                one_day:   { price: PROMOTION_PRICING.one_day,   label: "1 Day" },
                one_week:  { price: PROMOTION_PRICING.one_week,  label: "1 Week" },
                one_month: { price: PROMOTION_PRICING.one_month, label: "1 Month" },
                custom:    { pricePerDay: PROMOTION_PRICING.per_day, label: "Custom (per day)" },
            },
            types:   Object.keys(PROMOTION_SUBTYPES).reduce((acc, key) => {
                acc[key] = PROMOTION_SUBTYPES[key];
                return acc;
            }, {}),
            currency: "NGN",
        });
    }
}

function formatPromotion(p) {
    return {
        id:               p.id,
        title:            p.title,
        type:             p.type,
        subType:          p.subType,
        duration:         p.duration,
        customDays:       p.customDays,
        status:           p.status,
        pricePaid:        p.pricePaid,
        paymentStatus:    p.paymentStatus,
        paymentAuthUrl:   p.paymentAuthUrl,
        startDate:        p.startDate,
        endDate:          p.endDate,
        promotionProducts: (p.promotionProducts || []).map((pp) => ({
            productId:    pp.productId,
            productTitle: pp.product?.title,
        })),
        campaignProduct:  p.campaignProduct || null,
        createdAt:        p.createdAt,
        updatedAt:        p.updatedAt,
    };
}

function isClientError(error) {
    return (
        error.message.includes("not found") ||
        error.message.includes("must be") ||
        error.message.includes("Only") ||
        error.message.includes("Invalid") ||
        error.message.includes("required") ||
        error.message.includes("Maximum") ||
        error.message.includes("approved") ||
        error.message.includes("already paid") ||
        error.message.includes("accept")
    );
}

module.exports = new PromotionController();
