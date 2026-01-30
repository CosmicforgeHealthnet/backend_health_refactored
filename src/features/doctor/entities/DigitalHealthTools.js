const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'DigitalHealthTools',
  tableName: 'digital_health_tools',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    consentToUseAITools: { type: 'boolean', nullable: true },
    usageDescription: { type: 'text', nullable: true },
    useARVR: { type: 'boolean', nullable: true },
    createdAt: { type: 'timestamp', createDate: true },
    updatedAt: { type: 'timestamp', updateDate: true },
  },
  relations: {
    doctorProfile: {
      type: 'one-to-one',
      target: 'DoctorProfile',
      inverseSide: 'digitalHealthTools',
      joinColumn: { name: 'doctorProfileId' },
      onDelete: "CASCADE"
    },
  },
}); 