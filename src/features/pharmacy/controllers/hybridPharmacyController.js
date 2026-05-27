const hybridPharmacyService = require("../services/hybridPharmacyService");

const CLIENT_ERRORS = ["not found", "approved", "already enabled", "not enabled", "required", "Invalid"];

function isClientError(message) {
    return CLIENT_ERRORS.some((phrase) => message.includes(phrase));
}

class HybridPharmacyController {
    async enableVendorMode(req, res, next) {
        try {
            const vendor = await hybridPharmacyService.enableVendorMode(req.user.id, req.body);
            return res.status(201).json({
                success: true,
                message: "Vendor mode enabled. You can now list products on the CosmicForge shop, including medications.",
                vendor,
            });
        } catch (error) {
            if (isClientError(error.message)) {
                return res.status(400).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    async getVendorModeStatus(req, res, next) {
        try {
            const data = await hybridPharmacyService.getVendorModeStatus(req.user.id);
            return res.status(200).json({ success: true, ...data });
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    async disableVendorMode(req, res, next) {
        try {
            const result = await hybridPharmacyService.disableVendorMode(req.user.id);
            return res.status(200).json({ success: true, ...result });
        } catch (error) {
            if (isClientError(error.message)) {
                return res.status(400).json({ success: false, error: error.message });
            }
            next(error);
        }
    }
}

module.exports = new HybridPharmacyController();
