const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Incident',
    tableName: 'admin_ops_incidents',
    columns: {
        id: { type: 'uuid', primary: true, generated: 'uuid' },
        title: { type: 'varchar', length: 300 },
        description: { type: 'text', nullable: true },
        severity: {
            type: 'enum',
            enum: ['critical', 'high', 'medium', 'low'],
            default: 'medium',
        },
        status: {
            type: 'enum',
            enum: ['open', 'investigating', 'identified', 'monitoring', 'resolved', 'closed'],
            default: 'open',
        },
        affectedServices: { type: 'json', nullable: true },
        resolvedAt: { type: 'timestamp', nullable: true },
        resolvedBy: { type: 'uuid', nullable: true },
        createdBy: { type: 'uuid', nullable: true },
        metadata: { type: 'json', nullable: true },
        createdAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
        updatedAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
    },
});
