/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class Migrations1753302423801 {
    name = 'Migrations1753302423801'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "processor" character varying(20) NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."processor" IS 'Payment processor used (flutterwave, paystack)'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."processor" IS 'Payment processor used (flutterwave, paystack)'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "processor"`);
    }
}
