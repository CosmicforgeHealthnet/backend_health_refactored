const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'WebhookEndpoint',
    tableName: 'admin_ops_webhook_endpoints',
    columns: {
        id: { type: 'uuid', primary: true, generated: 'uuid' },
        name: { type: 'varchar', length: 150 },
        url: { type: 'varchar', length: 1000 },
        secret: { type: 'varchar', length: 500, nullable: true },
        events: { type: 'json', nullable: true },
        isActive: { type: 'boolean', default: true },
        provider: { type: 'varchar', length: 100, nullable: true },
        headers: { type: 'json', nullable: true },
        description: { type: 'text', nullable: true },
        createdAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
        updatedAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
    },
});
