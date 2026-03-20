// src/entities/PasswordResetToken.js
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'PasswordResetToken',
  tableName: 'password_reset_tokens',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    token: { type: 'varchar', unique: true },
    otp: { type: 'varchar', length: 6, nullable: true },
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