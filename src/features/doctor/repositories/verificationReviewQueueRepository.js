// src/repositories/verificationReviewQueueRepository.js
const AppDataSource = require("../../../config/database");
const { QueuePriority } = require("../entities/VerificationReviewQueue");
const { IsNull, LessThan } = require("typeorm");

class VerificationReviewQueueRepository {
    constructor() {
        this.repository = AppDataSource.getRepository("VerificationReviewQueue");
    }

    // Add to queue
    async addToQueue(queueData) {
        const queueItem = this.repository.create(queueData);
        return await this.repository.save(queueItem);
    }

    // Find by verification request ID
    async findByVerificationRequestId(verificationRequestId) {
        return await this.repository.findOne({
            where: { verificationRequestId },
            relations: ["verificationRequest", "assignedToUser"]
        });
    }

    // Get unassigned queue items
    async findUnassigned(limit = 50) {
        return await this.repository.find({
            where: {
                assignedTo: IsNull(),
                completedAt: IsNull()
            },
            relations: ["verificationRequest"],
            order: {
                priority: "DESC", // Higher priority first
                addedToQueueAt: "ASC" // Oldest first within same priority
            },
            take: limit
        });
    }

    // Get queue items assigned to user
    async findAssignedToUser(userId, includeCompleted = false) {
        const where = { assignedTo: userId };
        if (!includeCompleted) {
            where.completedAt = IsNull();
        }

        return await this.repository.find({
            where,
            relations: ["verificationRequest"],
            order: { assignedAt: "ASC" }
        });
    }

    // Assign queue item to user
    async assignToUser(verificationRequestId, userId) {
        return await this.repository.update(
            { verificationRequestId },
            {
                assignedTo: userId,
                assignedAt: new Date()
            }
        );
    }

    // Mark review as started
    async markReviewStarted(verificationRequestId) {
        return await this.repository.update(
            { verificationRequestId },
            { reviewStartedAt: new Date() }
        );
    }

    // Mark as completed
    async markCompleted(verificationRequestId) {
        return await this.repository.update(
            { verificationRequestId },
            { completedAt: new Date() }
        );
    }

    // Update priority
    async updatePriority(verificationRequestId, priority) {
        return await this.repository.update(
            { verificationRequestId },
            { priority }
        );
    }

    // Escalate item
    async escalate(verificationRequestId, escalatedTo, escalationReason) {
        return await this.repository.update(
            { verificationRequestId },
            {
                escalated: true,
                escalatedAt: new Date(),
                escalatedTo,
                escalationReason
            }
        );
    }

    // Mark SLA as breached
    async markSlaBreached(verificationRequestId) {
        return await this.repository.update(
            { verificationRequestId },
            { slaBreached: true }
        );
    }

    // Get queue statistics
    async getQueueStatistics() {
        const queryBuilder = this.repository.createQueryBuilder("queue");

        return await queryBuilder
            .select([
                "queue.priority",
                "COUNT(*) as count",
                "COUNT(CASE WHEN queue.assignedTo IS NOT NULL THEN 1 END) as assigned",
                "COUNT(CASE WHEN queue.completedAt IS NOT NULL THEN 1 END) as completed",
                "COUNT(CASE WHEN queue.slaBreached = true THEN 1 END) as slaBreached"
            ])
            .where("queue.completedAt IS NULL")
            .groupBy("queue.priority")
            .getRawMany();
    }

    // Get overdue items (past SLA target)
    async findOverdue() {
        return await this.repository.find({
            where: {
                slaTarget: LessThan(new Date()),
                completedAt: IsNull(),
                slaBreached: false
            },
            relations: ["verificationRequest", "assignedToUser"],
            order: { slaTarget: "ASC" }
        });
    }

    // Remove from queue
    async removeFromQueue(verificationRequestId) {
        return await this.repository.delete({ verificationRequestId });
    }
}

module.exports = new VerificationReviewQueueRepository();
