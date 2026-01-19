const { EntitySchema } = require("typeorm");

const RewardType = {
    DISCOUNT: 'discount',
    FREE_GIFT: 'free_gift',
    POINTS: 'points',
    NO_LUCK: 'no_luck'
};

const RewardStatus = {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    USED: 'used'
};

const SpinReward = new EntitySchema({
    name: "SpinReward",
    tableName: "marketing_spin_rewards",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        type: {
            type: "varchar", // using varchar for simplicity
            default: RewardType.DISCOUNT
        },
        description: {
            type: "varchar"
        },
        weight: {
            type: "int",
            default: 1
        },
        validityDays: {
            type: "int",
            default: 30
        },
        isActive: {
            type: "boolean",
            default: true
        },
        createdAt: {
            createDate: true
        },
        updatedAt: {
            updateDate: true
        }
    }
});

module.exports = {
    SpinReward,
    RewardType,
    RewardStatus
};
