const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'AiSupportMessage',
  tableName: 'ai_support_messages',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    sessionId: { type: 'uuid', nullable: false },
    senderId: { type: 'uuid', nullable: false },
    senderType: {
      type: 'enum',
      enum: ['user', 'ai', 'agent'],
      nullable: false
    },
    content: { type: 'text', nullable: false },
    metadata: { type: 'jsonb', nullable: true },
    createdAt: { type: 'timestamp', createDate: true }
  },
  relations: {
    session: {
      target: 'AiSupportSession',
      type: 'many-to-one',
      joinColumn: { name: 'sessionId' },
      nullable: false
    }
  },
  indices: [
    { name: 'IDX_AI_SUPPORT_MESSAGE_SESSION', columns: ['sessionId', 'createdAt'] },
    { name: 'IDX_AI_SUPPORT_MESSAGE_SENDER_TYPE', columns: ['senderType'] }
  ]
});
