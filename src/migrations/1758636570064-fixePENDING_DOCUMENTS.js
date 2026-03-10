/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class FixePENDINGDOCUMENTS1758636570064 {
    name = 'FixePENDINGDOCUMENTS1758636570064'

    async up(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."idx_verification_doctor_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_verification_country_status"`);
        await queryRunner.query(`ALTER TYPE "public"."verification_requests_status_enum" RENAME TO "verification_requests_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."verification_requests_status_enum" AS ENUM('pending', 'in_progress', 'pending_documents', 'api_verification', 'manual_review', 'approved', 'rejected', 'expired')`);
        await queryRunner.query(`ALTER TABLE "verification_requests" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "verification_requests" ALTER COLUMN "status" TYPE "public"."verification_requests_status_enum" USING "status"::"text"::"public"."verification_requests_status_enum"`);
        await queryRunner.query(`ALTER TABLE "verification_requests" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."verification_requests_status_enum_old"`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_verification_doctor_status" ON "verification_requests" ("doctorId", "status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_verification_country_status" ON "verification_requests" ("countryCode", "status") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."idx_verification_country_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_verification_doctor_status"`);
        await queryRunner.query(`CREATE TYPE "public"."verification_requests_status_enum_old" AS ENUM('pending', 'in_progress', 'api_verification', 'manual_review', 'approved', 'rejected', 'expired')`);
        await queryRunner.query(`ALTER TABLE "verification_requests" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "verification_requests" ALTER COLUMN "status" TYPE "public"."verification_requests_status_enum_old" USING "status"::"text"::"public"."verification_requests_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "verification_requests" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."verification_requests_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."verification_requests_status_enum_old" RENAME TO "verification_requests_status_enum"`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_verification_country_status" ON "verification_requests" ("countryCode", "status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_verification_doctor_status" ON "verification_requests" ("doctorId", "status") `);
    }
}
