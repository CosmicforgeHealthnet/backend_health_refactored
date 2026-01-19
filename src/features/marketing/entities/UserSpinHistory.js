const { EntitySchema } = require("typeorm");

const UserSpinHistory = new EntitySchema({
    name: "UserSpinHistory",
    tableName: "marketing_user_spin_history",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        email: {
            type: "varchar"
        },
        userId: {
            type: "varchar",
            nullable: true
        },
        rewardId: {
            type: "int"
        },
        rewardCode: {
            type: "varchar",
            nullable: true
        },
        emailVerificationToken: {
            type: "varchar",
            nullable: true
        },
        expiresAt: {
            type: "timestamp",
            nullable: true
        },
        status: {
            type: "varchar",
            default: "active"
        },
        emailVerified: {
            type: "boolean",
            default: false
        },
        usedAt: {
            type: "timestamp",
            nullable: true
        },
        createdAt: {
            createDate: true
        },
        updatedAt: {
            updateDate: true
        }
    },
    relations: {
        reward: {
            target: "SpinReward",
            type: "many-to-one",
            joinColumn: { name: "rewardId" },
            inverseSide: "spins"
        },
        user: {
            target: "User",
            type: "many-to-one",
            joinColumn: { name: "userId" }
        }
    }
});

module.exports = { UserSpinHistory };
