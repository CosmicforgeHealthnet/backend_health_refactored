/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * Adds NIN (National Identification Number) verification columns to verification_requests.
 * Used for the Nigeria-specific identity check that confirms the doctor's registered
 * name matches the government record for the NIN they submit.
 *
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddNinVerificationToVerificationRequests1900000000049 {
    name = 'AddNinVerificationToVerificationRequests1900000000049'

    async up(queryRunner) {
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."verification_requests_ninverificationstatus_enum" AS ENUM ('not_submitted', 'pending', 'verified', 'mismatch', 'failed');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "ninEncrypted" text`);
        await queryRunner.query(`ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "ninEncryptionKey" character varying`);
        await queryRunner.query(`ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "ninLast4" character varying(4)`);
        await queryRunner.query(`
            ALTER TABLE "verification_requests"
            ADD COLUMN IF NOT EXISTS "ninVerificationStatus" "public"."verification_requests_ninverificationstatus_enum" NOT NULL DEFAULT 'not_submitted'
        `);
        await queryRunner.query(`ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "ninVerifiedData" jsonb`);
        await queryRunner.query(`ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "ninNameMatchScore" integer`);
        await queryRunner.query(`ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "ninSubmittedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "ninVerifiedAt" TIMESTAMP`);

        await queryRunner.query(`COMMENT ON COLUMN "verification_requests"."ninEncrypted" IS 'AES-256-GCM encrypted NIN, hex-encoded'`);
        await queryRunner.query(`COMMENT ON COLUMN "verification_requests"."ninEncryptionKey" IS 'Hex key used to encrypt/decrypt ninEncrypted'`);
        await queryRunner.query(`COMMENT ON COLUMN "verification_requests"."ninLast4" IS 'Last 4 digits of the NIN, for display without decrypting'`);
        await queryRunner.query(`COMMENT ON COLUMN "verification_requests"."ninVerifiedData" IS 'Raw provider response: name, dob, gender, etc.'`);
        await queryRunner.query(`COMMENT ON COLUMN "verification_requests"."ninNameMatchScore" IS '0-100 similarity between platform name and NIN record name'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "verification_requests" DROP COLUMN IF EXISTS "ninVerifiedAt"`);
        await queryRunner.query(`ALTER TABLE "verification_requests" DROP COLUMN IF EXISTS "ninSubmittedAt"`);
        await queryRunner.query(`ALTER TABLE "verification_requests" DROP COLUMN IF EXISTS "ninNameMatchScore"`);
        await queryRunner.query(`ALTER TABLE "verification_requests" DROP COLUMN IF EXISTS "ninVerifiedData"`);
        await queryRunner.query(`ALTER TABLE "verification_requests" DROP COLUMN IF EXISTS "ninVerificationStatus"`);
        await queryRunner.query(`ALTER TABLE "verification_requests" DROP COLUMN IF EXISTS "ninLast4"`);
        await queryRunner.query(`ALTER TABLE "verification_requests" DROP COLUMN IF EXISTS "ninEncryptionKey"`);
        await queryRunner.query(`ALTER TABLE "verification_requests" DROP COLUMN IF EXISTS "ninEncrypted"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."verification_requests_ninverificationstatus_enum"`);
    }
}
