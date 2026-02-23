const AppDataSource = require("../../../config/database");

class PharmacyPricingRepository {
    get repo() {
        return AppDataSource.getRepository("PharmacyPricing");
    }

    async setPricing(pharmacyId, pricingData) {
        const { feeType, price, currency } = pricingData;

        // Check for existing pricing for this type and pharmacy
        let pricing = await this.repo.findOne({
            where: { pharmacyId, feeType, isActive: true }
        });

        if (pricing) {
            pricing.price = price;
            pricing.currency = currency || pricing.currency;
            pricing.updatedAt = new Date();
            return this.repo.save(pricing);
        } else {
            pricing = this.repo.create({
                pharmacyId,
                feeType,
                price,
                currency,
                isActive: true
            });
            return this.repo.save(pricing);
        }
    }

    async getPricing(pharmacyId) {
        return this.repo.find({
            where: { pharmacyId, isActive: true }
        });
    }

    async deletePricing(id) {
        return this.repo.update(id, { isActive: false, updatedAt: new Date() });
    }
}

module.exports = new PharmacyPricingRepository();
