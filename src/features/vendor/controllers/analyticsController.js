const analyticsService = require("../services/analyticsService");

const VALID_PERIODS = ["daily", "weekly", "monthly"];

class VendorAnalyticsController {
    async getOverview(req, res, next) {
        try {
            const data = await analyticsService.getOverview(req.user.id);
            return res.status(200).json({ success: true, overview: data });
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    async getSalesPerformance(req, res, next) {
        try {
            const { period = "daily", from, to } = req.query;

            if (!VALID_PERIODS.includes(period)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid period. Must be one of: ${VALID_PERIODS.join(", ")}`,
                });
            }

            const data = await analyticsService.getSalesPerformance(req.user.id, { period, from, to });
            return res.status(200).json({ success: true, sales: data });
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    async getProductPerformance(req, res, next) {
        try {
            const data = await analyticsService.getProductPerformance(req.user.id);
            return res.status(200).json({ success: true, products: data });
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    async getPromotionPerformance(req, res, next) {
        try {
            const data = await analyticsService.getPromotionPerformance(req.user.id);
            return res.status(200).json({ success: true, promotions: data });
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }
}

module.exports = new VendorAnalyticsController();
