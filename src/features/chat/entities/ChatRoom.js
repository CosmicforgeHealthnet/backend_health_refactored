// src/entities/chat/ChatRoom.js
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ChatRoom',
  tableName: 'chat_rooms',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    name: {
      type: 'varchar',
      length: 255,
      nullable: false
    },
    description: {
      type: 'text',
      nullable: true
    },
    type: {
      type: 'enum',
      enum: ['direct', 'group', 'appointment', 'support'],
      default: 'direct'
    },
    isPrivate: {
      type: 'boolean',
      default: false
    },
    maxParticipants: {
      type: 'int',
      default: 50
    },
    settings: {
      type: 'jsonb',
      nullable: true
    },
    metadata: {
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
    },
    deletedAt: {
      type: 'timestamp',
      deleteDate: true
    }
  },
  relations: {
    createdBy: {
      target: 'User',
      type: 'many-to-one',
      onDelete: "CASCADE",
      joinColumn: { name: 'createdById' },
      nullable: true
    },
    participants: {
      target: 'ChatParticipant',
      type: 'one-to-many',
      inverseSide: 'room'
    },
    messages: {
      target: 'ChatMessage',
      type: 'one-to-many',
      inverseSide: 'room'
    },
    appointmentChat: {
      target: 'AppointmentChat',
      type: 'one-to-one',
      mappedBy: true
    }
  },
//   indices: [
//     {
//       name: 'IDX_CHAT_ROOM_TYPE',
//       columns: ['type']
//     },
//     {
//       name: 'IDX_CHAT_ROOM_PRIVATE',
//       columns: ['isPrivate']
//     }
//   ]
});
