const platformConfigService = require("../services/platformConfigService");

const platformConfigCtrl = {

    async getConfig(req, res, next) {
        try {
            const config = await platformConfigService.getConfig();
            return res.status(200).json({
                success: true,
                config: {
                    platformFeeRate:      config[platformConfigService.KEYS.PLATFORM_FEE_RATE],
                    platformFeePercent:   `${(config[platformConfigService.KEYS.PLATFORM_FEE_RATE] * 100).toFixed(2)}%`,
                    vendorCommissionRate:    config[platformConfigService.KEYS.VENDOR_COMMISSION_RATE],
                    vendorCommissionPercent: `${(config[platformConfigService.KEYS.VENDOR_COMMISSION_RATE] * 100).toFixed(2)}%`,
                },
                rules: {
                    platformFee:      "Added ON TOP of order/appointment amount — paid by the customer",
                    vendorCommission: "Deducted FROM vendor earnings — does NOT affect customer-facing price",
                    pharmacy:         "Platform fee (7%) is charged to patient on top. Pharmacy receives 100% of their invoice amount. Exempt from commission only.",
                    doctorCommission: "10–30% based on subscription tier — not controlled here",
                },
            });
        } catch (error) {
            next(error);
        }
    },

    async updateConfig(req, res, next) {
        try {
            const { platformFeeRate, vendorCommissionRate } = req.body;
            const updated = await platformConfigService.updateConfig(
                { platformFeeRate, vendorCommissionRate },
                req.user.id
            );
            return res.status(200).json({
                success: true,
                message: "Platform config updated. New rates are active immediately.",
                config: {
                    platformFeeRate:         updated[platformConfigService.KEYS.PLATFORM_FEE_RATE],
                    platformFeePercent:      `${(updated[platformConfigService.KEYS.PLATFORM_FEE_RATE] * 100).toFixed(2)}%`,
                    vendorCommissionRate:    updated[platformConfigService.KEYS.VENDOR_COMMISSION_RATE],
                    vendorCommissionPercent: `${(updated[platformConfigService.KEYS.VENDOR_COMMISSION_RATE] * 100).toFixed(2)}%`,
                },
            });
        } catch (error) {
            if (error.message.includes("must be") || error.message.includes("No valid")) {
                return res.status(400).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    async previewFees(req, res, next) {
        try {
            const { amount, type } = req.query;
            if (!amount) return res.status(400).json({ success: false, error: "amount query param is required" });

            const preview = await platformConfigService.previewFees(amount, type || "vendor_order");
            return res.status(200).json({ success: true, preview });
        } catch (error) {
            if (error.message.includes("must be") || error.message.includes("Unknown type") || error.message.includes("positive")) {
                return res.status(400).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    async resetToDefaults(req, res, next) {
        try {
            const updated = await platformConfigService.resetToDefaults(req.user.id);
            return res.status(200).json({
                success: true,
                message: "Platform config reset to defaults (7% platform fee, 0% vendor commission).",
                config: {
                    platformFeeRate:         updated[platformConfigService.KEYS.PLATFORM_FEE_RATE],
                    platformFeePercent:      `${(updated[platformConfigService.KEYS.PLATFORM_FEE_RATE] * 100).toFixed(2)}%`,
                    vendorCommissionRate:    updated[platformConfigService.KEYS.VENDOR_COMMISSION_RATE],
                    vendorCommissionPercent: `${(updated[platformConfigService.KEYS.VENDOR_COMMISSION_RATE] * 100).toFixed(2)}%`,
                },
            });
        } catch (error) {
            next(error);
        }
    },
};

module.exports = platformConfigCtrl;
