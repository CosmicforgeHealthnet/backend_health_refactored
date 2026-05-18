const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'HealthCheckHistory',
    tableName: 'admin_ops_health_check_history',
    columns: {
        id: { type: 'uuid', primary: true, generated: 'uuid' },
        status: { type: 'varchar', length: 50 },
        version: { type: 'varchar', length: 50, nullable: true },
        environment: { type: 'varchar', length: 50, nullable: true },
        uptime: { type: 'float', nullable: true },
        details: { type: 'json', nullable: true },
        responseTimeMs: { type: 'int', nullable: true },
        checkedAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
        createdAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
    },
});
