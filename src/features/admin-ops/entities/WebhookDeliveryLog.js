const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'WebhookDeliveryLog',
    tableName: 'admin_ops_webhook_delivery_logs',
    columns: {
        id: { type: 'uuid', primary: true, generated: 'uuid' },
        webhookEndpointId: { type: 'uuid', nullable: true },
        event: { type: 'varchar', length: 150 },
        payload: { type: 'json', nullable: true },
        statusCode: { type: 'int', nullable: true },
        responseBody: { type: 'text', nullable: true },
        attempt: { type: 'int', default: 1 },
        status: {
            type: 'enum',
            enum: ['success', 'failed', 'pending'],
            default: 'pending',
        },
        deliveredAt: { type: 'timestamp', nullable: true },
        error: { type: 'text', nullable: true },
        provider: { type: 'varchar', length: 100, nullable: true },
        createdAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
    },
});
