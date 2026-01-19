// src/repositories/verificationApiLogRepository.js
const AppDataSource = require("../../../config/database");
const { ApiProvider } = require("../entities/VerificationApiLog");
const { LessThan } = require("typeorm");

class VerificationApiLogRepository {
    constructor() {
        this.repository = AppDataSource.getRepository("VerificationApiLog");
    }

    // Create API log entry
    async create(logData) {
        const log = this.repository.create(logData);
        return await this.repository.save(log);
    }

    // Log API call
    async logApiCall(verificationRequestId, provider, endpoint, method, requestPayload, responsePayload, responseCode, responseTime, success, errorMessage = null, calledBy = null) {
        return await this.create({
            verificationRequestId,
            provider,
            endpoint,
            method,
            requestPayload,
            responsePayload,
            responseCode,
            responseTime,
            success,
            errorMessage,
            calledBy
        });
    }

    // Find logs by verification request
    async findByVerificationRequestId(verificationRequestId) {
        return await this.repository.find({
            where: { verificationRequestId },
            order: { calledAt: "DESC" }
        });
    }

    // Find logs by provider
    async findByProvider(provider, limit = 100) {
        return await this.repository.find({
            where: { provider },
            order: { calledAt: "DESC" },
            take: limit
        });
    }

    // Get API performance statistics
    async getPerformanceStats(provider = null, startDate = null, endDate = null) {
        const queryBuilder = this.repository.createQueryBuilder("log");

        if (provider) {
            queryBuilder.andWhere("log.provider = :provider", { provider });
        }
        if (startDate) {
            queryBuilder.andWhere("log.calledAt >= :startDate", { startDate });
        }
        if (endDate) {
            queryBuilder.andWhere("log.calledAt <= :endDate", { endDate });
        }

        return await queryBuilder
            .select([
                "log.provider",
                "COUNT(*) as totalCalls",
                "SUM(CASE WHEN log.success = true THEN 1 ELSE 0 END) as successfulCalls",
                "AVG(log.responseTime) as avgResponseTime",
                "MAX(log.responseTime) as maxResponseTime",
                "MIN(log.responseTime) as minResponseTime"
            ])
            .groupBy("log.provider")
            .getRawMany();
    }

    // Get recent failed API calls
    async findRecentFailures(limit = 50) {
        return await this.repository.find({
            where: { success: false },
            relations: ["verificationRequest"],
            order: { calledAt: "DESC" },
            take: limit
        });
    }

    // Get rate limit information
    async getRateLimitStatus(provider) {
        return await this.repository.findOne({
            where: { provider },
            order: { calledAt: "DESC" }
        });
    }

    // Clean up old logs (keep last 90 days)
    async cleanupOldLogs(daysToKeep = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        return await this.repository.delete({
            calledAt: LessThan(cutoffDate)
        });
    }
}

module.exports = new VerificationApiLogRepository();
