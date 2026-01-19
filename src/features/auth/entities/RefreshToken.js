// src/entities/RefreshToken.js
const { EntitySchema: RefreshTokenSchema } = require('typeorm');

module.exports = new RefreshTokenSchema({
  name: 'RefreshToken',
  tableName: 'refresh_tokens',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    tokenHash: { type: 'varchar', unique: true },
    deviceFingerprint: { type: 'varchar' },
    userAgent: { type: 'text' },
    expiresAt: { type: 'timestamp' },
    revokedAt: { type: 'timestamp', nullable: true },
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