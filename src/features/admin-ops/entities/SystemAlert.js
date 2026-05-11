const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'SystemAlert',
    tableName: 'admin_ops_system_alerts',
    columns: {
        id: { type: 'uuid', primary: true, generated: 'uuid' },
        type: {
            type: 'enum',
            enum: ['job_failure', 'health_degraded', 'dead_letter', 'webhook_failure', 'custom'],
            default: 'custom',
        },
        severity: {
            type: 'enum',
            enum: ['critical', 'warning', 'info'],
            default: 'info',
        },
        message: { type: 'varchar', length: 500 },
        details: { type: 'json', nullable: true },
        source: { type: 'varchar', length: 200, nullable: true },
        isRead: { type: 'boolean', default: false },
        isResolved: { type: 'boolean', default: false },
        resolvedAt: { type: 'timestamp', nullable: true },
        createdAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
    },
});
