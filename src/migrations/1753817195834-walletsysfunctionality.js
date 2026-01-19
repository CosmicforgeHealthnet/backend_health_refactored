/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class Walletsysfunctionality1753817195834 {
    name = 'Walletsysfunctionality1753817195834'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "transferId"`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "requiresUserOtp"`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "transferCode"`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "paystackResponse"`);
        await queryRunner.query(`ALTER TABLE "doctor_wallets" ADD "walletPassword" character varying(255)`);
        await queryRunner.query(`COMMENT ON COLUMN "doctor_wallets"."walletPassword" IS 'Hashed password for wallet operations'`);
        await queryRunner.query(`ALTER TABLE "doctor_wallets" ADD "walletPasswordResetToken" character varying(255)`);
        await queryRunner.query(`COMMENT ON COLUMN "doctor_wallets"."walletPasswordResetToken" IS 'Token for wallet password reset'`);
        await queryRunner.query(`ALTER TABLE "doctor_wallets" ADD "walletPasswordResetExpiresAt" TIMESTAMP`);
        await queryRunner.query(`COMMENT ON COLUMN "doctor_wallets"."walletPasswordResetExpiresAt" IS 'When the wallet password reset token expires'`);
        await queryRunner.query(`ALTER TABLE "doctor_wallets" ADD "walletPasswordResetAttempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "doctor_wallets"."walletPasswordResetAttempts" IS 'Number of reset attempts to prevent abuse'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "otpCode" character varying(6)`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."otpCode" IS '6-digit OTP code for withdrawal verification'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "otpExpiresAt" TIMESTAMP`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."otpExpiresAt" IS 'When the OTP expires'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "otpAttempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."otpAttempts" IS 'Number of OTP attempts made'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "maxOtpAttempts" integer NOT NULL DEFAULT '3'`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."maxOtpAttempts" IS 'Maximum allowed OTP attempts'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "isOtpVerified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."isOtpVerified" IS 'Whether OTP has been successfully verified'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."isOtpVerified" IS 'Whether OTP has been successfully verified'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "isOtpVerified"`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."maxOtpAttempts" IS 'Maximum allowed OTP attempts'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "maxOtpAttempts"`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."otpAttempts" IS 'Number of OTP attempts made'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "otpAttempts"`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."otpExpiresAt" IS 'When the OTP expires'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "otpExpiresAt"`);
        await queryRunner.query(`COMMENT ON COLUMN "wallet_withdrawals"."otpCode" IS '6-digit OTP code for withdrawal verification'`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP COLUMN "otpCode"`);
        await queryRunner.query(`COMMENT ON COLUMN "doctor_wallets"."walletPasswordResetAttempts" IS 'Number of reset attempts to prevent abuse'`);
        await queryRunner.query(`ALTER TABLE "doctor_wallets" DROP COLUMN "walletPasswordResetAttempts"`);
        await queryRunner.query(`COMMENT ON COLUMN "doctor_wallets"."walletPasswordResetExpiresAt" IS 'When the wallet password reset token expires'`);
        await queryRunner.query(`ALTER TABLE "doctor_wallets" DROP COLUMN "walletPasswordResetExpiresAt"`);
        await queryRunner.query(`COMMENT ON COLUMN "doctor_wallets"."walletPasswordResetToken" IS 'Token for wallet password reset'`);
        await queryRunner.query(`ALTER TABLE "doctor_wallets" DROP COLUMN "walletPasswordResetToken"`);
        await queryRunner.query(`COMMENT ON COLUMN "doctor_wallets"."walletPassword" IS 'Hashed password for wallet operations'`);
        await queryRunner.query(`ALTER TABLE "doctor_wallets" DROP COLUMN "walletPassword"`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "paystackResponse" text`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "transferCode" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "requiresUserOtp" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" ADD "transferId" bigint`);
    }
}
