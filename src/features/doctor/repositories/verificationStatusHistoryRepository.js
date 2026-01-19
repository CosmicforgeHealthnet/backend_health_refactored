// src/repositories/verificationStatusHistoryRepository.js
const AppDataSource = require("../../../config/database");

class VerificationStatusHistoryRepository {
    constructor() {
        this.repository = AppDataSource.getRepository("VerificationStatusHistory");
    }

    // Create status history entry
    async create(historyData) {
        const history = this.repository.create(historyData);
        return await this.repository.save(history);
    }

    // Log status change
    async logStatusChange(verificationRequestId, fromStatus, toStatus, changedBy, changeReason = null, metadata = null, automatedChange = false) {
        return await this.create({
            verificationRequestId,
            fromStatus,
            toStatus,
            changedBy,
            changeReason,
            metadata,
            automatedChange
        });
    }

    // Get history by verification request
    async findByVerificationRequestId(verificationRequestId) {
        return await this.repository.find({
            where: { verificationRequestId },
            relations: ["changedByUser"],
            order: { changedAt: "ASC" }
        });
    }

    // Get recent status changes
    async findRecent(limit = 50) {
        return await this.repository.find({
            relations: ["verificationRequest", "changedByUser"],
            order: { changedAt: "DESC" },
            take: limit
        });
    }

    // Get status changes by user
    async findByUser(userId, limit = 50) {
        return await this.repository.find({
            where: { changedBy: userId },
            relations: ["verificationRequest"],
            order: { changedAt: "DESC" },
            take: limit
        });
    }

    // Get automated vs manual changes statistics
    async getChangeStatistics(startDate = null, endDate = null) {
        const queryBuilder = this.repository.createQueryBuilder("history");

        if (startDate) {
            queryBuilder.andWhere("history.changedAt >= :startDate", { startDate });
        }
        if (endDate) {
            queryBuilder.andWhere("history.changedAt <= :endDate", { endDate });
        }

        return await queryBuilder
            .select([
                "history.toStatus",
                "history.automatedChange",
                "COUNT(*) as count"
            ])
            .groupBy("history.toStatus, history.automatedChange")
            .getRawMany();
    }
}

module.exports = new VerificationStatusHistoryRepository();
