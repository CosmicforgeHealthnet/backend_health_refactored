// src/entities/Chat/ChatbotMessage.js
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ChatbotMessage',
  tableName: 'chatbot_messages',
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
    messageType: {
      type: 'enum',
      enum: ['user', 'bot'],
      nullable: false
    },
    role: {
      type: 'varchar',
      length: 50,
      nullable: false,
      comment: 'user, assistant, system for AI context'
    },
    metadata: {
      type: 'jsonb',
      nullable: true,
      comment: 'Store AI response metadata, tokens used, etc.'
    },
    sessionId: {
      type: 'uuid',
      nullable: false
    },
    userId: {
      type: 'uuid',
      nullable: false
    },
    processingTime: {
      type: 'int',
      nullable: true,
      comment: 'Time taken for AI to respond in milliseconds'
    },
    tokenCount: {
      type: 'int',
      nullable: true,
      comment: 'Number of tokens used for this message'
    },
    createdAt: {
      type: 'timestamp',
      createDate: true
    }
  },
  relations: {
    session: {
      target: 'ChatbotSession',
      type: 'many-to-one',
      joinColumn: { name: 'sessionId' },
      nullable: false
    },
    user: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'userId' },
      nullable: false
    }
  },
  indices: [
    {
      name: 'IDX_CHATBOT_MESSAGE_SESSION',
      columns: ['sessionId', 'createdAt']
    },
    {
      name: 'IDX_CHATBOT_MESSAGE_TYPE',
      columns: ['messageType']
    }
  ]
});
