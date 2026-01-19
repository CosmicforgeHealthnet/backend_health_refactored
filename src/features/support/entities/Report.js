
// entities/Report.js
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ReportSupport',
  tableName: 'support_report',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: "uuid",
    },
    userId: {
      type: 'uuid',
    },
    providerId: {
      type: 'uuid',
    },
    providerType: {
      type: 'enum',
      enum: ['healthcare_provider', 'lab', 'pharmacy'],
    },
    issueType: {
      type: 'enum',
      enum: ['unprofessional_behavior', 'harassment_verbal_abuse', 'medical_negligence', 'fraud_fake_profile', 'wrong_diagnosis', 'appointment_issues', 'prescription_error', 'privacy_violation', 'wrong_lab_result', 'lab_misconduct', 'pharmacy_misconduct'],
    },
    description: {
      type: 'text',
      nullable: true,
    },
    screenshotUrl: {
      type: 'varchar',
      length: 500,
      nullable: true
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
      onDelete:'CASCADE',
      joinColumn: { name: 'userId' },
    }
  },
});