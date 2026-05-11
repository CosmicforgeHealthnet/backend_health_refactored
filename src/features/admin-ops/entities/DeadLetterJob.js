const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'DeadLetterJob',
    tableName: 'admin_ops_dead_letter_jobs',
    columns: {
        id: { type: 'uuid', primary: true, generated: 'uuid' },
        jobExecutionId: { type: 'uuid', nullable: true },
        jobName: { type: 'varchar', length: 150 },
        payload: { type: 'json', nullable: true },
        errorMessage: { type: 'text', nullable: true },
        failedAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
        retryCount: { type: 'int', default: 0 },
        maxRetries: { type: 'int', default: 3 },
        status: {
            type: 'enum',
            enum: ['pending_retry', 'exhausted', 'manually_resolved'],
            default: 'pending_retry',
        },
        resolvedAt: { type: 'timestamp', nullable: true },
        resolvedBy: { type: 'uuid', nullable: true },
        createdAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
        updatedAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
    },
});
