// entities/Insurance.js
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'InsuranceSupport',
  tableName: 'support_insurance',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid',
    },
    userId: {
      type: 'uuid',
    },
    issueType: {
      type: 'enum',
      enum: ['insurance_not_recognized', 'policy_details_incorrect', 'claim_status_delay', 'coverage_rejected', 'upload_document_error', 'wrong_billing'],
    },
    insuranceProviderName: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    policyNumber: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    serviceAffected: {
      type: 'enum',
      enum: ['consultation', 'lab', 'pharmacy'],
      nullable: true,
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
      onDelete:'CASCADE',

      joinColumn: { name: 'userId' },
    },
  },
});