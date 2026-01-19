const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Wallet',
  tableName: 'wallets',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    paymentMethod: { type: 'varchar' },
    bankName: { type: 'varchar' },
    accountNumber: { type: 'varchar' },
    accountName: { type: 'varchar' },
    swiftCode: { type: 'varchar', nullable: true },
    sortCode: { type: 'varchar', nullable: true },
    frequencyPayout: { type: 'varchar' },
    createdAt: { type: 'timestamp', createDate: true },
    updatedAt: { type: 'timestamp', updateDate: true },
  },
  relations: {
    doctorProfile: {
      type: 'one-to-one',
      target: 'DoctorProfile',
      inverseSide: 'wallet',
      joinColumn: { name: 'doctorProfileId' },
      onDelete: "CASCADE"
    },
  },
});