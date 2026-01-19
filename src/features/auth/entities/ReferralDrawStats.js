const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ReferralDrawStats',
  tableName: 'referral_draw_stats',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    drawId: {
      type: 'uuid',
      nullable: false
    },
    userId: {
      type: 'uuid',
      nullable: false
    },
    referralCount: {
      type: 'int',
      default: 0,
      comment: 'Number of successful referrals during this draw period'
    },
    position: {
      type: 'int',
      nullable: true,
      comment: 'Final position in leaderboard (calculated when draw ends)'
    },
    isWinner: {
      type: 'boolean',
      default: false
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
    draw: {
      target: 'ReferralDraw',
      type: 'many-to-one',
      joinColumn: { name: 'drawId' },
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
      name: 'IDX_REFERRAL_DRAW_STATS_DRAW',
      columns: ['drawId']
    },
    {
      name: 'IDX_REFERRAL_DRAW_STATS_USER',
      columns: ['userId']
    },
    {
      name: 'IDX_REFERRAL_DRAW_STATS_COUNT',
      columns: ['referralCount']
    },
    {
      name: 'IDX_REFERRAL_DRAW_STATS_POSITION',
      columns: ['position']
    }
  ]
});