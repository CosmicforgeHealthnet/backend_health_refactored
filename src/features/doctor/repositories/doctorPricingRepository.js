
// ===================================
// src/features/doctor/repositories/doctorPricingRepository.js
// ===================================

const AppDataSource = require('../../../config/database');
const DoctorPricing = require('../entities/DoctorPricing');


class DoctorPricingRepository {
    constructor() {
        this.repository = AppDataSource.getRepository(DoctorPricing);
    }

    async create(pricingData) {
        const pricing = this.repository.create(pricingData);
        return await this.repository.save(pricing);
    }

    async findByDoctorId(doctorId) {
        return await this.repository.find({
            where: { doctorId, isActive: true },
            order: { consultationType: 'ASC' }
        });
    }

    async findByDoctorAndTypeAndDuration(doctorId, consultationType, duration) {
        return await this.repository.findOne({
            where: { doctorId, consultationType, duration, isActive: true }
        });
    }

    async update(id, updateData) {
        await this.repository.update(id, updateData);
        return await this.repository.findOne({ where: { id } });
    }

    async delete(id) {
        return await this.repository.update(id, { isActive: false });
    }
}

module.exports = DoctorPricingRepository;
