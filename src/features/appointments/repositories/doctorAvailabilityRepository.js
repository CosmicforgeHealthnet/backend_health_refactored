// ===================================
// src/repositories/DoctorAvailabilityRepository.js
// ===================================

const AppDataSource = require('../../../config/database');
const DoctorAvailability = require('../entities/DoctorAvailability');
const DoctorUnavailability = require('../entities/DoctorUnavailability');
const { LessThanOrEqual, MoreThanOrEqual } = require("typeorm")



class DoctorAvailabilityRepository {
    constructor() {
        this.repository = AppDataSource.getRepository(DoctorAvailability);
        this.unavailabilityRepository = AppDataSource.getRepository(DoctorUnavailability);
    }

    async create(availabilityData) {
        const availability = this.repository.create(availabilityData);
        return await this.repository.save(availability);
    }

    async findByDoctorId(doctorId) {
        return await this.repository.find({
            where: { doctorId, isAvailable: true },
            order: { dayOfWeek: 'ASC', startTime: 'ASC' }
        });
    }

    async findByDoctorAndDay(doctorId, dayOfWeek) {
        return await this.repository.find({
            where: { doctorId, dayOfWeek, isAvailable: true },
            order: { startTime: 'ASC' }
        });
    }

    async update(id, updateData) {
        await this.repository.update(id, updateData);
        return await this.repository.findOne({ where: { id } });
    }

    async delete(id) {
        return await this.repository.update(id, { isAvailable: false });
    }

    // Unavailability methods
    async createUnavailability(unavailabilityData) {
        const unavailability = this.unavailabilityRepository.create(unavailabilityData);
        return await this.unavailabilityRepository.save(unavailability);
    }

    async findUnavailabilityByDoctor(doctorId, startDate, endDate) {
        return await this.unavailabilityRepository.find({
            where: {
                doctorId,
                isActive: true,
                startDate: LessThanOrEqual(endDate),
                endDate: MoreThanOrEqual(startDate)
            },
            order: { startDate: 'ASC' }
        });
    }
}

module.exports = DoctorAvailabilityRepository;
