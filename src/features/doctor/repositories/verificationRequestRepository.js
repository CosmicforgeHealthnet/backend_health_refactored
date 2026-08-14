// src/repositories/verificationRequestRepository.js
const AppDataSource = require("../../../config/database");
const { In, LessThan } = require('typeorm');
const { VerificationStatus, VerificationMethod, VerificationTier } = require("../entities/VerificationRequest");

class VerificationRequestRepository {
    constructor() {
        this.repository = AppDataSource.getRepository("VerificationRequest");
    }

    // Create new verification request
    async create(verificationData) {
        const verificationRequest = this.repository.create(verificationData);
        return await this.repository.save(verificationRequest);
    }

    // Find by ID with relations
    async findById(id, relations = []) {
        return await this.repository.findOne({
            where: { id },
            relations
        });
    }

    // Has this doctor ever submitted a verification request (any status)?
    // Used to flag accounts that registered but never hit /verification/submit —
    // those are invisible to the admin queue, which only lists existing rows.
    async existsForDoctor(doctorId) {
        const count = await this.repository.count({ where: { doctorId } });
        return count > 0;
    }

    // Find by doctor ID
    async findByDoctorId(doctorId, relations = []) {
        return await this.repository.find({
            where: { doctorId },
            relations,
            order: { createdAt: "DESC" }
        });
    }

    // Find current active request for doctor
    async findActiveByDoctorId(doctorId) {
        return await this.repository.findOne({
            where: {
                doctorId,
                status: In([
                    VerificationStatus.PENDING,
                    VerificationStatus.IN_PROGRESS,
                    VerificationStatus.API_VERIFICATION,
                    VerificationStatus.MANUAL_REVIEW
                ])
            },
            relations: ["documents", "statusHistory"]
        });
    }

    // Find by license number and country
    async findByLicenseAndCountry(licenseNumber, countryCode) {
        return await this.repository.findOne({
            where: { licenseNumber, countryCode },
            relations: ["doctor"]
        });
    }

    // Get verification requests by status
    async findByStatus(status, limit = 50, offset = 0) {
        return await this.repository.find({
            where: { status },
            relations: ["doctor", "assignedReviewer"],
            order: { submittedAt: "ASC" },
            take: limit,
            skip: offset
        });
    }

    // Get verification requests by country and status
    async findByCountryAndStatus(countryCode, status, limit = 50) {
        return await this.repository.find({
            where: { countryCode, status },
            relations: ["doctor"],
            order: { submittedAt: "ASC" },
            take: limit
        });
    }

    // Get verification requests assigned to reviewer
    async findByReviewer(reviewerId, status = null) {
        const where = { assignedReviewerId: reviewerId };
        if (status) where.status = status;

        return await this.repository.find({
            where,
            relations: ["doctor", "documents"],
            order: { reviewStartedAt: "ASC" }
        });
    }

    // Update verification request
    async update(id, updateData) {
        await this.repository.update(id, updateData);
        return await this.findById(id);
    }

    // Update status
    async updateStatus(id, newStatus, updatedBy, reviewNotes = null) {
        const updateData = {
            status: newStatus,
            updatedBy,
            updatedAt: new Date()
        };

        // Add status-specific timestamps
        if (newStatus === VerificationStatus.APPROVED) {
            updateData.approvedAt = new Date();
        } else if (newStatus === VerificationStatus.REJECTED) {
            updateData.rejectedAt = new Date();
        } else if (newStatus === VerificationStatus.MANUAL_REVIEW) {
            updateData.reviewStartedAt = new Date();
        }

        if (reviewNotes) {
            updateData.reviewNotes = reviewNotes;
        }

        return await this.update(id, updateData);
    }

    // Assign to reviewer
    async assignReviewer(id, reviewerId) {
        return await this.update(id, {
            assignedReviewerId: reviewerId,
            reviewStartedAt: new Date()
        });
    }

    // Get verification statistics
    async getStatistics(startDate = null, endDate = null) {
        const queryBuilder = this.repository.createQueryBuilder("vr");

        if (startDate) {
            queryBuilder.andWhere("vr.submittedAt >= :startDate", { startDate });
        }
        if (endDate) {
            queryBuilder.andWhere("vr.submittedAt <= :endDate", { endDate });
        }

        return await queryBuilder
            .select([
                "vr.status",
                "vr.countryCode",
                "vr.method",
                "vr.tier",
                "COUNT(*) as count",
                "AVG(vr.confidenceScore) as avgConfidence"
            ])
            .groupBy("vr.status, vr.countryCode, vr.method, vr.tier")
            .getRawMany();
    }

    // Get pending verifications count by country
    async getPendingCountByCountry() {
        return await this.repository
            .createQueryBuilder("vr")
            .select(["vr.countryCode", "COUNT(*) as count"])
            .where("vr.status IN (:...statuses)", {
                statuses: [
                    VerificationStatus.PENDING,
                    VerificationStatus.IN_PROGRESS,
                    VerificationStatus.MANUAL_REVIEW
                ]
            })
            .groupBy("vr.countryCode")
            .getRawMany();
    }

    // Get expired verifications
    async findExpired() {
        return await this.repository.find({
            where: {
                expiresAt: LessThan(new Date()),
                status: In([
                    VerificationStatus.PENDING,
                    VerificationStatus.IN_PROGRESS,
                    VerificationStatus.MANUAL_REVIEW
                ])
            }
        });
    }

    // Soft delete (mark as expired)
    async markExpired(id) {
        return await this.update(id, {
            status: VerificationStatus.EXPIRED,
            rejectedAt: new Date()
        });
    }

    // Delete verification request
    async delete(id) {
        return await this.repository.delete(id);
    }

    // Save verification request
    async save(verificationRequest) {
        return await this.repository.save(verificationRequest);
    }
}

module.exports = new VerificationRequestRepository();
