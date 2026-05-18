const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'JobExecution',
    tableName: 'admin_ops_job_executions',
    columns: {
        id: { type: 'uuid', primary: true, generated: 'uuid' },
        jobName: { type: 'varchar', length: 150 },
        jobType: {
            type: 'enum',
            enum: ['cron', 'background', 'scheduled', 'manual'],
            default: 'cron',
        },
        status: {
            type: 'enum',
            enum: ['pending', 'running', 'completed', 'failed', 'dead_letter'],
            default: 'pending',
        },
        startedAt: { type: 'timestamp', nullable: true },
        completedAt: { type: 'timestamp', nullable: true },
        durationMs: { type: 'int', nullable: true },
        input: { type: 'json', nullable: true },
        output: { type: 'json', nullable: true },
        error: { type: 'text', nullable: true },
        attempts: { type: 'int', default: 1 },
        scheduledAt: { type: 'timestamp', nullable: true },
        createdAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
    },
});
