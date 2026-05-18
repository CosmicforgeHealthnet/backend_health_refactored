const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'EnvironmentConfig',
    tableName: 'admin_ops_environment_configs',
    columns: {
        id: { type: 'uuid', primary: true, generated: 'uuid' },
        key: { type: 'varchar', length: 150 },
        value: { type: 'text', nullable: true },
        description: { type: 'text', nullable: true },
        isPublic: { type: 'boolean', default: false },
        environment: { type: 'varchar', length: 50, default: 'all' },
        createdAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
        updatedAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
    },
});
