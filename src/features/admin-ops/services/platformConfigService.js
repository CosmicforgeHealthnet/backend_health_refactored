const AppDataSource = require("../../../config/database");

const CATEGORY = "payment_config";

// Config keys
const KEYS = {
    PLATFORM_FEE_RATE:      "platform_fee_rate",
    VENDOR_COMMISSION_RATE: "vendor_commission_rate",
};

// Defaults (used when DB row is missing)
const DEFAULTS = {
    [KEYS.PLATFORM_FEE_RATE]:      0.07,  // 7% — added ON TOP for customer
    [KEYS.VENDOR_COMMISSION_RATE]: 0,     // TBD — deducted from vendor earnings
};

// In-memory cache — avoids hitting DB on every single payment
let _cache          = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS  = 5 * 60 * 1000; // 5 minutes

function repo() {
    return AppDataSource.getRepository("AdminSetting");
}

function invalidateCache() {
    _cache = null;
    _cacheExpiresAt = 0;
}

const platformConfigService = {

    KEYS,

    // ─── Read ──────────────────────────────────────────────────────────────────

    async getConfig() {
        if (_cache && Date.now() < _cacheExpiresAt) return _cache;

        const rows = await repo().find({ where: { category: CATEGORY } });
        const config = { ...DEFAULTS };

        for (const row of rows) {
            if (row.key in config) {
                config[row.key] = typeof row.value === "number"
                    ? row.value
                    : parseFloat(row.value);
            }
        }

        _cache          = config;
        _cacheExpiresAt = Date.now() + CACHE_TTL_MS;

        return config;
    },

    async getPlatformFeeRate() {
        const config = await this.getConfig();
        return config[KEYS.PLATFORM_FEE_RATE];
    },

    async getVendorCommissionRate() {
        const config = await this.getConfig();
        return config[KEYS.VENDOR_COMMISSION_RATE];
    },

    // ─── Update ────────────────────────────────────────────────────────────────

    async updateConfig({ platformFeeRate, vendorCommissionRate }, adminUserId) {
        const updates = [];

        if (platformFeeRate !== undefined) {
            const rate = parseFloat(platformFeeRate);
            if (isNaN(rate) || rate < 0 || rate > 1) {
                throw new Error("platformFeeRate must be a decimal between 0 and 1 (e.g. 0.07 for 7%)");
            }
            updates.push({ key: KEYS.PLATFORM_FEE_RATE, value: rate });
        }

        if (vendorCommissionRate !== undefined) {
            const rate = parseFloat(vendorCommissionRate);
            if (isNaN(rate) || rate < 0 || rate > 1) {
                throw new Error("vendorCommissionRate must be a decimal between 0 and 1 (e.g. 0.10 for 10%)");
            }
            updates.push({ key: KEYS.VENDOR_COMMISSION_RATE, value: rate });
        }

        if (updates.length === 0) throw new Error("No valid fields provided to update");

        for (const { key, value } of updates) {
            const existing = await repo().findOne({ where: { category: CATEGORY, key } });
            if (existing) {
                await repo().update({ id: existing.id }, { value, updatedBy: adminUserId || null });
            } else {
                await repo().save({ category: CATEGORY, key, value, updatedBy: adminUserId || null });
            }
        }

        invalidateCache();

        return this.getConfig();
    },

    // ─── Preview: show split for a given amount ───────────────────────────────

    async previewFees(amount, type = "vendor_order") {
        const config = await this.getConfig();
        const base   = parseFloat(amount);
        if (!base || base <= 0) throw new Error("amount must be a positive number");

        const platformFeeRate = config[KEYS.PLATFORM_FEE_RATE];
        const platformFee     = parseFloat((base * platformFeeRate).toFixed(4));
        const grossAmount     = parseFloat((base + platformFee).toFixed(4));

        if (type === "vendor_order") {
            const commissionRate   = config[KEYS.VENDOR_COMMISSION_RATE];
            const commissionAmount = parseFloat((base * commissionRate).toFixed(4));
            const vendorReceives   = parseFloat((base - commissionAmount).toFixed(4));

            return {
                type:              "vendor_order",
                baseAmount:        base,
                platformFeeRate:   `${(platformFeeRate * 100).toFixed(2)}%`,
                platformFeeAmount: platformFee,
                grossAmount,
                commissionRate:    `${(commissionRate * 100).toFixed(2)}%`,
                commissionAmount,
                vendorReceives,
                platformTotalRevenue: parseFloat((platformFee + commissionAmount).toFixed(4)),
                note: "Vendor commission rate is TBD — currently 0%",
            };
        }

        if (type === "appointment") {
            return {
                type:              "appointment",
                baseAmount:        base,
                platformFeeRate:   `${(platformFeeRate * 100).toFixed(2)}%`,
                platformFeeAmount: platformFee,
                grossAmount,
                doctorCommission:  "10–30% based on doctor subscription tier (not configurable here)",
                note:              "Platform fee added on top. Doctor commission is subscription-based.",
            };
        }

        if (type === "pharmacy") {
            return {
                type:            "pharmacy",
                baseAmount:      base,
                platformFeeRate: "EXEMPT",
                grossAmount:     base,
                pharmacyReceives: base,
                note:            "Pharmacies are exempt from platform fee and commission.",
            };
        }

        throw new Error(`Unknown type. Must be: vendor_order, appointment, pharmacy`);
    },

    // ─── Reset to defaults ────────────────────────────────────────────────────

    async resetToDefaults(adminUserId) {
        return this.updateConfig(
            {
                platformFeeRate:      DEFAULTS[KEYS.PLATFORM_FEE_RATE],
                vendorCommissionRate: DEFAULTS[KEYS.VENDOR_COMMISSION_RATE],
            },
            adminUserId
        );
    },
};

module.exports = platformConfigService;
