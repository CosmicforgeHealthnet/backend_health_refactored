const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'FeatureFlag',
    tableName: 'admin_ops_feature_flags',
    columns: {
        id: { type: 'uuid', primary: true, generated: 'uuid' },
        key: { type: 'varchar', length: 100, unique: true },
        name: { type: 'varchar', length: 200 },
        description: { type: 'text', nullable: true },
        isEnabled: { type: 'boolean', default: false },
        enabledFor: { type: 'json', nullable: true },
        rolloutPercentage: { type: 'int', nullable: true },
        environment: { type: 'varchar', length: 50, default: 'all' },
        metadata: { type: 'json', nullable: true },
        createdBy: { type: 'uuid', nullable: true },
        updatedBy: { type: 'uuid', nullable: true },
        createdAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
        updatedAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
    },
});
