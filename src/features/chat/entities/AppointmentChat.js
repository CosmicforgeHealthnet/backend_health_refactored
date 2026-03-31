const { EntitySchema } = require('typeorm');

// src/entities/chat/AppointmentChat.js (Extension for medical features)
module.exports = new EntitySchema({
    name: 'AppointmentChat',
    tableName: 'appointment_chats',
    columns: {
      id: {
        type: 'uuid',
        primary: true,
        generated: 'uuid'
      },
      // appointmentId: {
      //    type: 'uuid',
      //    nullable: false
      // },
      status: {
        type: 'enum',
        enum: ['scheduled', 'active', 'completed', 'cancelled'],
        default: 'scheduled'
      },
      scheduledStartTime: {
        type: 'timestamp',
        nullable: false
      },
      scheduledEndTime: {
        type: 'timestamp',
        nullable: false
      },
      actualStartTime: {
        type: 'timestamp',
        nullable: true
      },
      actualEndTime: {
        type: 'timestamp',
        nullable: true
      },
      autoCloseEnabled: {
        type: 'boolean',
        default: true
      },
      preJoinAllowed: {
        type: 'boolean',
        default: false,
        comment: 'Allow joining before scheduled time'
      },
      postChatDuration: {
        type: 'int',
        default: 300,
        comment: 'Seconds after end time before auto-close'
      },
      settings: {
        type: 'jsonb',
        nullable: true
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
      room: {
        target: 'ChatRoom',
        type: 'many-to-one',
        joinColumn: { name: 'roomId' },
        nullable: false
      },
      appointment: {
        target: 'Appointment',
        type: 'one-to-one',
        joinColumn: { name: 'appointmentId', referencedColumnName: 'id' },
        nullable: true,
        onDelete: 'CASCADE'
      },
      doctor: {
        target: 'User',
        type: 'many-to-one',
        joinColumn: { name: 'doctorId' },
      onDelete: "CASCADE",
        nullable: false
      },
      patient: {
        target: 'User',
        type: 'many-to-one',
        joinColumn: { name: 'patientId' },
      onDelete: "CASCADE",
        nullable: false
      }
    },
    // indices: [
    //   {
    //     name: 'IDX_APPOINTMENT_CHAT_STATUS',
    //     columns: ['status']
    //   },
    //   {
    //     name: 'IDX_APPOINTMENT_CHAT_SCHEDULED_START',
    //     columns: ['scheduledStartTime']
    //   },
    //   {
    //     name: 'IDX_APPOINTMENT_CHAT_DOCTOR',
    //     columns: ['doctor']
    //   },
    //   {
    //     name: 'IDX_APPOINTMENT_CHAT_PATIENT',
    //     columns: ['patient']
    //   }
    // ]
  });