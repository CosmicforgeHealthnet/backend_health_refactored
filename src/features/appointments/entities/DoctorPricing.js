// ===================================
// src/entities/doctor/DoctorPricing.js
// ===================================

const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'DoctorPricing',
  tableName: 'doctor_pricing',
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
    consultationType: {
      type: 'enum',
      enum: ['consultation', 'follow-up', 'routine-checkup', 'urgent'],
      nullable: false
    },
    price: {
      type: 'decimal',
      precision: 10,
      scale: 2,
      nullable: false
    },
    currency: {
      type: 'varchar',
      length: 3,
      default: 'NGN'
    },
    duration: {
      type: 'int',
      default: 30,
      comment: 'Duration in minutes'
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
  }
,  
  indices: [
    {
      name: 'IDX_DOCTOR_PRICING_DOCTOR',
      columns: ['doctorId']
    },
    {
      name: 'IDX_DOCTOR_PRICING_TYPE',
      columns: ['consultationType']
    },
    {
      name: 'IDX_DOCTOR_PRICING_ACTIVE',
      columns: ['isActive']
    }
  ]
});