// src/entities/Chat/ChatbotSession.js
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ChatbotSession',
  tableName: 'chatbot_sessions',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    title: {
      type: 'varchar',
      length: 255,
      nullable: true,
      comment: 'Auto-generated from first message'
    },
    sessionType: {
      type: 'enum',
      enum: ['general', 'doctor'],
      nullable: false,
      comment: 'general for /chat, doctor for /doctorchat'
    },
    userId: {
      type: 'uuid',
      nullable: false
    },
    userType: {
      type: 'enum',
      enum: ['patient', 'doctor'],
      nullable: false
    },
    isActive: {
      type: 'boolean',
      default: true
    },
    metadata: {
      type: 'jsonb',
      nullable: true,
      comment: 'Store conversation context and AI metadata'
    },
    messageCount: {
      type: 'int',
      default: 0,
      comment: 'Total messages in this session'
    },
    lastActivityAt: {
      type: 'timestamp',
      default: () => 'CURRENT_TIMESTAMP'
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
    user: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'userId' },
      nullable: false
    },
    messages: {
      target: 'ChatbotMessage',
      type: 'one-to-many',
      inverseSide: 'session',
      cascade: true
    }
  },
  indices: [
    {
      name: 'IDX_CHATBOT_SESSION_USER_TYPE',
      columns: ['userId', 'sessionType']
    },
    {
      name: 'IDX_CHATBOT_SESSION_ACTIVE',
      columns: ['isActive', 'lastActivityAt']
    }
  ]
});
