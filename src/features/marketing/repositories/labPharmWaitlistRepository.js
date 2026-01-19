const AppDataSource = require('../../../config/database');
const { WAITLIST_STATUS } = require('../../pharmacy/entities/LabPharmWaitlist');

class LabPharmWaitlistRepository {
    static getRepository() {
        return AppDataSource.getRepository('LabPharmWaitlist');
    }

    static async findByEmail(email) {
        const repo = this.getRepository();
        return repo.findOne({ where: { email } });
    }

    static create(data) {
        const repo = this.getRepository();
        return repo.create(data);
    }

    static async save(entry) {
        const repo = this.getRepository();
        return repo.save(entry);
    }

    static async markEmailSent(id) {
        const repo = this.getRepository();
        return repo.update(id, {
            emailSent: true,
            emailSentAt: new Date()
        });
    }

    static async findById(id) {
        const repo = this.getRepository();
        return repo.findOne({ where: { id } });
    }

    static async findAll(options = {}) {
        const repo = this.getRepository();
        const { status, limit = 50, offset = 0 } = options;
        const where = {};
        if (status) where.status = status;

        return repo.find({
            where,
            take: limit,
            skip: offset,
            order: { createdAt: 'DESC' }
        });
    }

    static async searchWaitlist(query) {
        const repo = this.getRepository();
        return repo.createQueryBuilder('waitlist')
            .where('waitlist.fullName ILIKE :query OR waitlist.email ILIKE :query OR waitlist.facilityName ILIKE :query', { query: `%${query}%` })
            .orderBy('waitlist.createdAt', 'DESC')
            .getMany();
    }

    static async updateStatus(id, status, adminNotes) {
        const repo = this.getRepository();
        const updateData = { status };
        if (adminNotes) updateData.adminNotes = adminNotes;

        return repo.update(id, updateData);
    }

    static async findPendingLaunchNotifications() {
        const repo = this.getRepository();
        return repo.find({
            where: {
                status: WAITLIST_STATUS.PENDING,
                launchNotificationSent: false
            }
        });
    }

    static async markLaunchNotificationSent(id) {
        const repo = this.getRepository();
        return repo.update(id, {
            launchNotificationSent: true,
            launchNotificationSentAt: new Date()
        });
    }

    static async getWaitlistStats() {
        const repo = this.getRepository();
        const result = await repo.createQueryBuilder('waitlist')
            .select('waitlist.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .groupBy('waitlist.status')
            .getRawMany();

        // Convert to object format needed by service
        const stats = {};
        result.forEach(row => {
            stats[row.status] = parseInt(row.count);
        });
        return stats;
    }

    static async getTotalCount() {
        const repo = this.getRepository();
        return repo.count();
    }

    static async findRecentRegistrations(limit = 10) {
        const repo = this.getRepository();
        return repo.find({
            order: { createdAt: 'DESC' },
            take: limit
        });
    }

    static async getCountByStatus(status) {
        const repo = this.getRepository();
        return repo.count({ where: { status } });
    }

    static async findByLocation(city, state) {
        const repo = this.getRepository();
        const where = {};
        if (city) where.city = city;
        if (state) where.state = state;

        return repo.find({
            where,
            order: { createdAt: 'DESC' }
        });
    }

    static async deleteOldEntries(olderThanDays) {
        const repo = this.getRepository();
        const date = new Date();
        date.setDate(date.getDate() - olderThanDays);

        const result = await repo.createQueryBuilder()
            .delete()
            .from('LabPharmWaitlist')
            .where('createdAt < :date', { date })
            .andWhere('status = :status', { status: WAITLIST_STATUS.DECLINED })
            .execute();

        return result;
    }
}

module.exports = LabPharmWaitlistRepository;
