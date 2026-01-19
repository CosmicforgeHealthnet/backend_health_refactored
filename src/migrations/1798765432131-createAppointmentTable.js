// // ===================================
// // src/migrations/CreateAppointmentTable.js
// // ===================================

// const { MigrationInterface, QueryRunner, Table, Index } = require('typeorm');

// class CreateAppointmentTable1703001000000 {
//   async up(queryRunner) {
//     await queryRunner.createTable(
//       new Table({
//         name: 'appointments',
//         columns: [
//           {
//             name: 'id',
//             type: 'uuid',
//             isPrimary: true,
//             generationStrategy: 'uuid',
//             default: 'uuid_generate_v4()'
//           },
//           {
//             name: 'patientId',
//             type: 'uuid',
//             isNullable: false
//           },
//           {
//             name: 'doctorId',
//             type: 'uuid',
//             isNullable: false
//           },
//           {
//             name: 'appointmentDate',
//             type: 'date',
//             isNullable: false
//           },
//           {
//             name: 'appointmentTime',
//             type: 'time',
//             isNullable: false
//           },
//           {
//             name: 'duration',
//             type: 'integer',
//             default: 30
//           },
//           {
//             name: 'endTime',
//             type: 'time',
//             isNullable: true
//           },
//           {
//             name: 'status',
//             type: 'enum',
//             enum: ['pending', 'scheduled', 'completed', 'cancelled', 'rescheduled'],
//             default: "'pending'"
//           },
//           {
//             name: 'type',
//             type: 'enum',
//             enum: ['consultation', 'follow-up', 'routine-checkup'],
//             default: "'consultation'"
//           },
//           {
//             name: 'priority',
//             type: 'enum',
//             enum: ['routine', 'urgent', 'high'],
//             default: "'routine'"
//           },
//           {
//             name: 'reason',
//             type: 'text',
//             isNullable: false
//           },
//           {
//             name: 'notes',
//             type: 'text',
//             isNullable: true
//           },
//           {
//             name: 'symptoms',
//             type: 'jsonb',
//             isNullable: true
//           },
//           {
//             name: 'appointmentMethod',
//             type: 'enum',
//             enum: ['google-meet', 'zoom', 'phone', 'chat'],
//             default: "'google-meet'"
//           },
//           {
//             name: 'meetingProvider',
//             type: 'enum',
//             enum: ['google', 'zoom'],
//             isNullable: true
//           },
//           {
//             name: 'meetingLink',
//             type: 'varchar',
//             length: '500',
//             isNullable: true
//           },
//           {
//             name: 'meetingId',
//             type: 'varchar',
//             length: '255',
//             isNullable: true
//           },
//           {
//             name: 'meetingPassword',
//             type: 'varchar',
//             length: '255',
//             isNullable: true
//           },
//           {
//             name: 'googleMeetCode',
//             type: 'varchar',
//             length: '255',
//             isNullable: true
//           },
//           {
//             name: 'zoomMeetingId',
//             type: 'varchar',
//             length: '255',
//             isNullable: true
//           },
//           {
//             name: 'hostKey',
//             type: 'varchar',
//             length: '255',
//             isNullable: true
//           },
//           {
//             name: 'consultationFee',
//             type: 'decimal',
//             precision: 10,
//             scale: 2,
//             isNullable: false
//           },
//           {
//             name: 'paymentStatus',
//             type: 'enum',
//             enum: ['pending', 'completed', 'failed', 'refunded'],
//             default: "'pending'"
//           },
//           {
//             name: 'paymentId',
//             type: 'varchar',
//             length: '255',
//             isNullable: true
//           },
//           {
//             name: 'paymentMethod',
//             type: 'varchar',
//             length: '100',
//             isNullable: true
//           },
//           {
//             name: 'insuranceCovered',
//             type: 'boolean',
//             default: false
//           },
//           {
//             name: 'copay',
//             type: 'decimal',
//             precision: 10,
//             scale: 2,
//             isNullable: true
//           },
//           {
//             name: 'reminderSent',
//             type: 'boolean',
//             default: false
//           },
//           {
//             name: 'reminderSentAt',
//             type: 'timestamp',
//             isNullable: true
//           },
//           {
//             name: 'notificationPreferences',
//             type: 'jsonb',
//             isNullable: true
//           },
//           {
//             name: 'isFirstVisit',
//             type: 'boolean',
//             default: true
//           },
//           {
//             name: 'followUpRequired',
//             type: 'boolean',
//             default: false
//           },
//           {
//             name: 'followUpDate',
//             type: 'date',
//             isNullable: true
//           },
//           {
//             name: 'prescriptions',
//             type: 'jsonb',
//             isNullable: true
//           },
//           {
//             name: 'labOrdersRequired',
//             type: 'jsonb',
//             isNullable: true
//           },
//           {
//             name: 'createdAt',
//             type: 'timestamp',
//             default: 'CURRENT_TIMESTAMP'
//           },
//           {
//             name: 'updatedAt',
//             type: 'timestamp',
//             default: 'CURRENT_TIMESTAMP',
//             onUpdate: 'CURRENT_TIMESTAMP'
//           },
//           {
//             name: 'createdBy',
//             type: 'varchar',
//             length: '255',
//             isNullable: true
//           },
//           {
//             name: 'lastModifiedBy',
//             type: 'varchar',
//             length: '255',
//             isNullable: true
//           },
//           {
//             name: 'completedAt',
//             type: 'timestamp',
//             isNullable: true
//           },
//           {
//             name: 'cancelledAt',
//             type: 'timestamp',
//             isNullable: true
//           },
//           {
//             name: 'cancellationReason',
//             type: 'text',
//             isNullable: true
//           },
//           {
//             name: 'cancelledBy',
//             type: 'varchar',
//             length: '255',
//             isNullable: true
//           }
//         ],
//         indices: [
//           new Index('IDX_APPOINTMENT_PATIENT', ['patientId']),
//           new Index('IDX_APPOINTMENT_DOCTOR', ['doctorId']),
//           new Index('IDX_APPOINTMENT_DATE', ['appointmentDate']),
//           new Index('IDX_APPOINTMENT_STATUS', ['status']),
//           new Index('IDX_APPOINTMENT_PAYMENT_STATUS', ['paymentStatus']),
//           new Index('IDX_APPOINTMENT_DATE_TIME', ['appointmentDate', 'appointmentTime']),
//           new Index('IDX_APPOINTMENT_DOCTOR_DATE', ['doctorId', 'appointmentDate'])
//         ]
//       }),
//       true
//     );

//     // Add foreign key constraints (when User tables are created)
//     // await queryRunner.createForeignKey('appointments', new ForeignKey({
//     //   columnNames: ['patientId'],
//     //   referencedTableName: 'users',
//     //   referencedColumnNames: ['id'],
//     //   onDelete: 'CASCADE'
//     // }));

//     // await queryRunner.createForeignKey('appointments', new ForeignKey({
//     //   columnNames: ['doctorId'],
//     //   referencedTableName: 'users',
//     //   referencedColumnNames: ['id'],
//     //   onDelete: 'CASCADE'
//     // }));
//   }

//   async down(queryRunner) {
//     await queryRunner.dropTable('appointments');
//   }
// }

// module.exports = CreateAppointmentTable1703001000000;