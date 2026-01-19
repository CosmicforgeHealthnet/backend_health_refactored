const { EntitySchema } = require('typeorm');


// src/entities/chat/ChatParticipant.js
module.exports = new EntitySchema({
    name: 'ChatParticipant',
    tableName: 'chat_participants',
    columns: {
      id: {
        type: 'uuid',
        primary: true,
        generated: 'uuid'
      },
      role: {
        type: 'enum',
        enum: ['admin', 'moderator', 'member'],
        default: 'member'
      },
      permissions: {
        type: 'jsonb',
        nullable: true,
        comment: 'Custom permissions for this participant'
      },
      isActive: {
        type: 'boolean',
        default: true
      },
      lastReadAt: {
        type: 'timestamp',
        nullable: true
      },
      joinedAt: {
        type: 'timestamp',
        createDate: true
      },
      leftAt: {
        type: 'timestamp',
        nullable: true
      },
      metadata: {
        type: 'jsonb',
        nullable: true
      }
    },
    relations: {
      user: {
        target: 'User',
        type: 'many-to-one',
        onDelete: "CASCADE",
        joinColumn: { name: 'userId' },
        nullable: false
      },
      room: {
        target: 'ChatRoom',
        type: 'many-to-one',
      onDelete: "CASCADE",
        joinColumn: { name: 'roomId' },
        nullable: false
      },
      addedBy: {
        target: 'User',
        type: 'many-to-one',
      onDelete: "CASCADE",

        joinColumn: { name: 'addedById' },
        nullable: true
      }
    },
    uniques: [
      {
        name: 'UQ_CHAT_PARTICIPANT_USER_ROOM',
        columns: ['user', 'room']
      }
    ],
    // indices: [
    //   {
    //     name: 'IDX_CHAT_PARTICIPANT_USER',
    //     columns: ['user']
    //   },
    //   {
    //     name: 'IDX_CHAT_PARTICIPANT_ROOM',
    //     columns: ['room']
    //   },
    //   {
    //     name: 'IDX_CHAT_PARTICIPANT_ACTIVE',
    //     columns: ['isActive']
    //   }
    // ]
  });