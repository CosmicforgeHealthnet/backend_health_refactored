const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'ServiceRegistry',
    tableName: 'admin_ops_service_registry',
    columns: {
        id: { type: 'uuid', primary: true, generated: 'uuid' },
        name: { type: 'varchar', length: 100, unique: true },
        displayName: { type: 'varchar', length: 150 },
        baseUrl: { type: 'varchar', length: 500, nullable: true },
        healthEndpoint: { type: 'varchar', length: 500, nullable: true },
        status: {
            type: 'enum',
            enum: ['up', 'down', 'degraded', 'unknown'],
            default: 'unknown',
        },
        version: { type: 'varchar', length: 50, nullable: true },
        tags: { type: 'json', nullable: true },
        metadata: { type: 'json', nullable: true },
        lastCheckedAt: { type: 'timestamp', nullable: true },
        createdAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
        updatedAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
    },
});
