// src/entities/AuthEvent.js
const { EntitySchema: AuthEventSchema } = require('typeorm');

module.exports = new AuthEventSchema({
  name: 'AuthEvent',
  tableName: 'auth_events',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    eventType: { type: 'varchar' },
    ip: { type: 'varchar' },
    userAgent: { type: 'text' },
    timestamp: { type: 'timestamp', createDate: true },
  },
  relations: {
    user: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: true,
      onDelete: 'CASCADE'
    }
  }
});