const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'UserReferral',
  tableName: 'user_referrals',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    referrerId: {
      type: 'uuid',
      nullable: false,
      comment: 'User who made the referral'
    },
    referredUserId: {
      type: 'uuid',
      nullable: true,
      comment: 'User who was referred'
    },
    referralCode: {
      type: 'varchar',
      length: 50,
      nullable: false,
      comment: 'Unique referral code used'
    },
    drawId: {
      type: 'uuid',
      nullable: true,
      comment: 'Draw period when this referral was made'
    },
    status: {
      type: 'enum',
      enum: ['pending', 'verified', 'invalid'],
      default: 'pending'
    },
    verifiedAt: {
      type: 'timestamp',
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
    referrer: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'referrerId' },
      nullable: true,
      onDelete: "SET NULL",

    },
    referredUser: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'referredUserId' },
      nullable: true,
      onDelete: "SET NULL",

    },
    draw: {
      target: 'ReferralDraw',
      type: 'many-to-one',
      joinColumn: { name: 'drawId' },
      nullable: true,
      onDelete: "SET NULL"
    }
  },
  indices: [
    {
      name: 'IDX_USER_REFERRAL_REFERRER',
      columns: ['referrerId']
    },
    {
      name: 'IDX_USER_REFERRAL_REFERRED',
      columns: ['referredUserId']
    },
    {
      name: 'IDX_USER_REFERRAL_CODE',
      columns: ['referralCode']
    },
    {
      name: 'IDX_USER_REFERRAL_STATUS',
      columns: ['status']
    },
    {
      name: 'IDX_USER_REFERRAL_DRAW',
      columns: ['drawId']
    }
  ]
});