/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class Walletsysytem1753443836162 {
    name = 'Walletsysytem1753443836162'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD COLUMN IF NOT EXISTS "processor" character varying(20) NOT NULL DEFAULT 'flutterwave'`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."processor" IS 'Payment processor used (flutterwave, paystack)'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."processor" IS 'Payment processor used (flutterwave, paystack)'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "processor"`);
    }
}
