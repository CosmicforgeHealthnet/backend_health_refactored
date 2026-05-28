const { AppDataSource } = require("../../../config/database");

const VALID_VENDOR_CATEGORIES = [
    "health_wellness",
    "medical_supplies",
    "baby_mother_care",
    "fitness_lifestyle",
    "nutrition_healthy_living",
    "others",
];

class HybridPharmacyService {
    async enableVendorMode(userId, body = {}) {
        const pharmacyRepo = AppDataSource.getRepository("PharmacyProfile");
        const vendorRepo   = AppDataSource.getRepository("VendorProfile");

        const pharmacy = await pharmacyRepo.findOne({ where: { userId } });
        if (!pharmacy) throw new Error("Pharmacy profile not found for this account");

        if (pharmacy.verificationStatus !== "approved") {
            throw new Error(
                `Your pharmacy must be fully approved before enabling vendor mode. Current status: ${pharmacy.verificationStatus}`
            );
        }

        const existing = await vendorRepo.findOne({ where: { userId } });
        if (existing) throw new Error("Vendor mode is already enabled for this account");

        const { state, city } = body;
        if (!state || !city) {
            throw new Error("state and city are required to enable vendor mode");
        }

        const category = body.businessCategory || "health_wellness";
        if (!VALID_VENDOR_CATEGORIES.includes(category)) {
            throw new Error(`Invalid businessCategory. Must be one of: ${VALID_VENDOR_CATEGORIES.join(", ")}`);
        }

        const vendor = vendorRepo.create({
            userId,
            businessName:        body.businessName        || pharmacy.pharmacyName,
            businessCategory:    category,
            businessEmail:       body.businessEmail        || pharmacy.email,
            businessPhone:       body.businessPhone        || pharmacy.phone,
            country:             body.country              || "Nigeria",
            state,
            city,
            fullAddress:         body.fullAddress          || pharmacy.address,
            businessDescription: body.businessDescription  || pharmacy.description || pharmacy.pharmacyName,
            businessWebsite:     pharmacy.website          || null,
            logoUrl:             pharmacy.logoUrl          || null,
            verificationStatus:  "approved",
            isActive:            true,
            documentsSubmitted:  true,
            isHybridPharmacy:    true,
            pharmacyProfileId:   pharmacy.id,
        });

        await vendorRepo.save(vendor);
        return vendor;
    }

    async getVendorModeStatus(userId) {
        const pharmacyRepo = AppDataSource.getRepository("PharmacyProfile");
        const vendorRepo   = AppDataSource.getRepository("VendorProfile");

        const pharmacy = await pharmacyRepo.findOne({ where: { userId } });
        if (!pharmacy) throw new Error("Pharmacy profile not found for this account");

        const vendor = await vendorRepo.findOne({ where: { userId, isHybridPharmacy: true } });

        return {
            vendorModeEnabled: !!vendor,
            pharmacy: {
                id:                 pharmacy.id,
                pharmacyName:       pharmacy.pharmacyName,
                verificationStatus: pharmacy.verificationStatus,
            },
            vendor: vendor
                ? {
                    id:                 vendor.id,
                    businessName:       vendor.businessName,
                    businessCategory:   vendor.businessCategory,
                    verificationStatus: vendor.verificationStatus,
                    isActive:           vendor.isActive,
                    createdAt:          vendor.createdAt,
                  }
                : null,
        };
    }

    async disableVendorMode(userId) {
        const vendorRepo = AppDataSource.getRepository("VendorProfile");

        const vendor = await vendorRepo.findOne({ where: { userId, isHybridPharmacy: true } });
        if (!vendor) throw new Error("Vendor mode is not enabled for this account");

        vendor.isActive = false;
        await vendorRepo.save(vendor);
        return { message: "Vendor mode disabled. Your products will no longer appear in the shop." };
    }
}

module.exports = new HybridPharmacyService();
