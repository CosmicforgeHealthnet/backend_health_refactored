const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ReferralDraw',
  tableName: 'referral_draws',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    title: {
      type: 'varchar',
      length: 255,
      nullable: false
    },
    description: {
      type: 'text',
      nullable: true
    },
    startDate: {
      type: 'timestamp',
      nullable: false
    },
    endDate: {
      type: 'timestamp',
      nullable: false
    },
    status: {
      type: 'enum',
      enum: ['pending', 'active', 'ended', 'cancelled'],
      default: 'pending'
    },
    maxWinners: {
      type: 'int',
      default: 10,
      comment: 'Maximum number of winners for this draw'
    },
    isActive: {
      type: 'boolean',
      default: true
    },
    createdBy: {
      type: 'uuid',
      nullable: false,
      comment: 'Admin/Marketing team member who created this draw'
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
    creator: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'createdBy' },
      nullable: false
    },
    referralStats: {
      target: 'ReferralDrawStats',
      type: 'one-to-many',
      inverseSide: 'draw'
    }
  },
  indices: [
    {
      name: 'IDX_REFERRAL_DRAW_STATUS',
      columns: ['status']
    },
    {
      name: 'IDX_REFERRAL_DRAW_DATES',
      columns: ['startDate', 'endDate']
    },
    {
      name: 'IDX_REFERRAL_DRAW_ACTIVE',
      columns: ['isActive']
    }
  ]
});