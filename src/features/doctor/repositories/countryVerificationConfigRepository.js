// src/repositories/countryVerificationConfigRepository.js
const AppDataSource = require("../../../config/database");

class CountryVerificationConfigRepository {
    constructor() {
        this.repository = AppDataSource.getRepository("CountryVerificationConfig");
    }

    // Create config
    async create(configData) {
        const config = this.repository.create(configData);
        return await this.repository.save(config);
    }

    // Find by country code
    async findByCountryCode(countryCode) {
        return await this.repository.findOne({
            where: { countryCode: countryCode.toUpperCase() }
        });
    }

    // Get all active configurations
    async findAllActive() {
        return await this.repository.find({
            where: { isActive: true },
            order: { countryName: "ASC" }
        });
    }

    // Get configurations by tier
    async findByTier(tier) {
        return await this.repository.find({
            where: { tier, isActive: true },
            order: { countryName: "ASC" }
        });
    }

    // Get configurations with API support
    async findWithApiSupport() {
        return await this.repository.find({
            where: { hasApi: true, isActive: true },
            order: { countryName: "ASC" }
        });
    }

    // Update configuration
    async update(countryCode, updateData) {
        await this.repository.update({ countryCode }, updateData);
        return await this.findByCountryCode(countryCode);
    }

    // Toggle active status
    async toggleActive(countryCode) {
        const config = await this.findByCountryCode(countryCode);
        if (config) {
            return await this.update(countryCode, {
                isActive: !config.isActive,
                updatedAt: new Date()
            });
        }
        return null;
    }

    // Get supported countries list
    async getSupportedCountries() {
        return await this.repository.find({
            where: { isActive: true },
            select: ["countryCode", "countryName", "tier", "method"],
            order: { countryName: "ASC" }
        });
    }

    // Save configuration
    async save(config) {
        return await this.repository.save(config);
    }
}

module.exports = new CountryVerificationConfigRepository();
