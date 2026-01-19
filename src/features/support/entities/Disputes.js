// entities/Dispute.js
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'DisputeSupport',
  tableName: 'support_disputes',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid',
    },
    userId: {
      type: 'uuid',
    },
    transactionId: {
      type: 'uuid',
      nullable: true
    },
    disputeType: {
      type: 'enum',
      enum: ['incorrect_billing', 'doctor_no_show', 'poor_service_quality', 'refund_request', 'transaction_issues'],
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
      enum: ['pending', 'under_review', 'resolved', 'closed'],
      default: 'pending',
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
    // transaction: {
    //   type: 'many-to-one',
    //   target: 'Transaction',
    //   joinColumn: { name: 'transactionId' },
    // },
  },
});