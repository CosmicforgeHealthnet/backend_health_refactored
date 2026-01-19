/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class WalletsysytemAddOn1753464882250 {
    name = 'WalletsysytemAddOn1753464882250'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "transferCode" character varying(255)`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."transferCode" IS 'Paystack transfer code for OTP completion'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "transferId" bigint`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."transferId" IS 'Paystack transfer ID'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "paystackResponse" text`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."paystackResponse" IS 'Full Paystack API response (JSON)'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "requiresUserOtp" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."requiresUserOtp" IS 'Whether this withdrawal requires user OTP'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "parentWithdrawalId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."parentWithdrawalId" IS 'Links multiple withdrawals from same request'`);
        await queryRunner.query(`ALTER TYPE "public"."wallet_withdrawals_status_enum" RENAME TO "wallet_withdrawals_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."wallet_withdrawals_status_enum" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'pending_otp')`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ALTER COLUMN "status" TYPE "public"."wallet_withdrawals_status_enum" USING "status"::"text"::"public"."wallet_withdrawals_status_enum"`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."wallet_withdrawals_status_enum_old"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."wallet_withdrawals_status_enum_old" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled')`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ALTER COLUMN "status" TYPE "public"."wallet_withdrawals_status_enum_old" USING "status"::"text"::"public"."wallet_withdrawals_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."wallet_withdrawals_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."wallet_withdrawals_status_enum_old" RENAME TO "wallet_withdrawals_status_enum"`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."parentWithdrawalId" IS 'Links multiple withdrawals from same request'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "parentWithdrawalId"`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."requiresUserOtp" IS 'Whether this withdrawal requires user OTP'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "requiresUserOtp"`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."paystackResponse" IS 'Full Paystack API response (JSON)'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "paystackResponse"`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."transferId" IS 'Paystack transfer ID'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "transferId"`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."transferCode" IS 'Paystack transfer code for OTP completion'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "transferCode"`);
    }
}
