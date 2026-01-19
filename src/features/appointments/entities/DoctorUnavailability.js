// ===================================
// src/entities/doctor/DoctorUnavailability.js
// ===================================

const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'DoctorUnavailability',
  tableName: 'doctor_unavailability',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    doctorId: {
      type: 'uuid',
      nullable: false
    },
    startDate: {
      type: 'date',
      nullable: false
    },
    endDate: {
      type: 'date',
      nullable: false
    },
    startTime: {
      type: 'time',
      nullable: true,
      comment: 'If null, entire day is unavailable'
    },
    endTime: {
      type: 'time',
      nullable: true,
      comment: 'If null, entire day is unavailable'
    },
    reason: {
      type: 'varchar',
      length: 255,
      nullable: true
    },
    type: {
      type: 'enum',
      enum: ['vacation', 'sick', 'meeting', 'personal', 'other'],
      default: 'other'
    },
    isActive: {
      type: 'boolean',
      default: true
    },
    createdAt: {
      type: 'timestamp',
      createDate: true
    },
    updatedAt: {
      type: 'timestamp',
      updateDate: true
    }
  },

  relations: {
    doctor: {
      target: 'User',
      type: 'many-to-one', 
      joinColumn: { name: 'doctorId' },
      onDelete: "CASCADE",
      nullable: false
    }
  },  
  indices: [
    {
      name: 'IDX_DOCTOR_UNAVAILABILITY_DOCTOR',
      columns: ['doctorId']
    },
    {
      name: 'IDX_DOCTOR_UNAVAILABILITY_DATE_RANGE',
      columns: ['startDate', 'endDate']
    },
    {
      name: 'IDX_DOCTOR_UNAVAILABILITY_ACTIVE',
      columns: ['isActive']
    }
  ]
});