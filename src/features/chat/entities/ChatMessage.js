const { EntitySchema } = require('typeorm');

// src/entities/chat/ChatMessage.js
module.exports = new EntitySchema({
  name: 'ChatMessage',
  tableName: 'chat_messages',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    content: {
      type: 'text',
      nullable: false
    },
    type: {
      type: 'enum',
      enum: ['text', 'image', 'file', 'system', 'typing'],
      default: 'text'
    },
    metadata: {
      type: 'jsonb',
      nullable: true
    },
    edited: {
      type: 'boolean',
      default: false
    },
    editHistory: {
      type: 'jsonb',
      nullable: true
    },
    deleted: {
      type: 'boolean',
      default: false
    },
    deletedAt: {
      type: 'timestamp',
      nullable: true
    },
    readBy: {
      type: 'jsonb',
      nullable: true,
      comment: 'Array of user IDs who have read this message'
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
    sender: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'senderId' },
      onDelete: "CASCADE",
      nullable: false
    },
    room: {
      target: 'ChatRoom',
      type: 'many-to-one',
      joinColumn: { name: 'roomId' },
      onDelete: "CASCADE",
      nullable: false
    },
    replyTo: {
      target: 'ChatMessage',
      type: 'many-to-one',
      joinColumn: { name: 'replyToId' },
      nullable: true
    },
    replies: {
      target: 'ChatMessage',
      type: 'one-to-many',
      inverseSide: 'replyTo'
    }
  },
//   indices: [
//     {
//       name: 'IDX_CHAT_MESSAGE_ROOM',
//       columns: ['room']
//     },
//     {
//       name: 'IDX_CHAT_MESSAGE_SENDER',
//       columns: ['sender']
//     },
//     {
//       name: 'IDX_CHAT_MESSAGE_CREATED',
//       columns: ['createdAt']
//     },
//     {
//       name: 'IDX_CHAT_MESSAGE_TYPE',
//       columns: ['type']
//     }
//   ]
});