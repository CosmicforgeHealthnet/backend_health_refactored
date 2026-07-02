const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'AiSupportSession',
  tableName: 'ai_support_sessions',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    userId: { type: 'uuid', nullable: false },
    userRole: { type: 'varchar', length: 50, nullable: false },
    status: {
      type: 'enum',
      enum: ['active', 'escalated', 'agent_joined', 'closed'],
      default: 'active'
    },
    escalationReason: { type: 'text', nullable: true },
    agentId: { type: 'uuid', nullable: true },
    messageCount: { type: 'int', default: 0 },
    lastActivityAt: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
    closedAt: { type: 'timestamp', nullable: true },
    createdAt: { type: 'timestamp', createDate: true },
    updatedAt: { type: 'timestamp', updateDate: true }
  },
  relations: {
    user: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'userId' },
      nullable: false
    },
    agent: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'agentId' },
      nullable: true
    },
    messages: {
      target: 'AiSupportMessage',
      type: 'one-to-many',
      inverseSide: 'session',
      cascade: true
    }
  },
  indices: [
    { name: 'IDX_AI_SUPPORT_SESSION_USER', columns: ['userId'] },
    { name: 'IDX_AI_SUPPORT_SESSION_STATUS', columns: ['status'] },
    { name: 'IDX_AI_SUPPORT_SESSION_AGENT', columns: ['agentId'] }
  ]
});
