// src/migrations/1800000000000-AddOtpToVerificationTables.js
// Adds the `otp` column to email_verifications and password_reset_tokens tables
// This is required because TypeORM does NOT use synchronize:true on the live DB

module.exports = class AddOtpToVerificationTables1800000000000 {
    name = 'AddOtpToVerificationTables1800000000000'

    async up(queryRunner) {
        // Add otp column to email_verifications (if not exists, safe to run multiple times)
        await queryRunner.query(`
            ALTER TABLE "email_verifications" 
            ADD COLUMN IF NOT EXISTS "otp" varchar(6)
        `);

        // Add otp column to password_reset_tokens
        await queryRunner.query(`
            ALTER TABLE "password_reset_tokens" 
            ADD COLUMN IF NOT EXISTS "otp" varchar(6)
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "email_verifications" DROP COLUMN IF EXISTS "otp"`);
        await queryRunner.query(`ALTER TABLE "password_reset_tokens" DROP COLUMN IF EXISTS "otp"`);
    }
}
