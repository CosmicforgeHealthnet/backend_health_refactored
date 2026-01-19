// ===================================
// entities/AccountSupport.js
// ===================================
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'AccountSupport',
  tableName: 'account_support',
  columns: {
    id: {
      type: 'int',
      primary: true,
      generated: true,
    },
    userId: {
      type: 'int',
    },
    issueType: {
      type: 'enum',
      enum: ['account_information_error', 'dependent_account_issue', 'unable_to_update_profile', 'deactivation_request', 'double_accounts_conflict'],
    },
    description: {
      type: 'text',
      nullable: true,
    },
    screenshotUrl: {
      type: 'varchar',
      length: 500,
      nullable: true,
    },
    status: {
      type: 'enum',
      enum: ['pending', 'in_progress', 'resolved', 'closed'],
      default: 'pending',
    },
    priority: {
      type: 'enum',
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    assignedTo: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    resolutionNotes: {
      type: 'text',
      nullable: true,
    },
    resolvedAt: {
      type: 'timestamp',
      nullable: true,
    },
    createdAt: {
      type: 'timestamp',
      default: () => 'CURRENT_TIMESTAMP',
    },
    updatedAt: {
      type: 'timestamp',
      default: () => 'CURRENT_TIMESTAMP',
      onUpdate: 'CURRENT_TIMESTAMP',
    },
  },
  relations: {
    user: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: { name: 'userId' },
      onDelete: 'CASCADE'
    },
  },
});




