// src/entities/MagicLinkToken.js
const { EntitySchema: MagicLinkSchema } = require('typeorm');

module.exports = new MagicLinkSchema({
  name: 'MagicLinkToken',
  tableName: 'magic_link_tokens',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    token: { type: 'varchar', unique: true },
    ip: { type: 'varchar' },
    userAgent: { type: 'text' },
    expiresAt: { type: 'timestamp' },
    usedAt: { type: 'timestamp', nullable: true },
    createdAt: { type: 'timestamp', createDate: true },
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
