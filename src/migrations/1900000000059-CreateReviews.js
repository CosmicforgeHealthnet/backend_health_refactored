/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * Adds a "reviews" table so a doctor and patient can each leave one review
 * per completed appointment (one row per appointmentId + direction). This is
 * separate from the existing "user_ratings" table, which is a generic,
 * appointment-independent aggregate rating on a doctor's profile only.
 *
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class CreateReviews1900000000059 {
    name = 'CreateReviews1900000000059'

    async up(queryRunner) {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "reviews" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "appointmentId" uuid NOT NULL REFERENCES "appointments"("id") ON DELETE CASCADE,
                "authorId" uuid NOT NULL,
                "targetId" uuid NOT NULL,
                "direction" varchar(20) NOT NULL CHECK ("direction" IN ('patient_to_doctor','doctor_to_patient')),
                "rating" decimal(2,1) NOT NULL CHECK ("rating" >= 1 AND "rating" <= 5),
                "comment" text,
                "createdAt" timestamp NOT NULL DEFAULT now(),
                "updatedAt" timestamp NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_REVIEW_APPOINTMENT_DIRECTION" ON "reviews" ("appointmentId", "direction")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_REVIEW_TARGET" ON "reviews" ("targetId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_REVIEW_AUTHOR" ON "reviews" ("authorId")
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_REVIEW_AUTHOR"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_REVIEW_TARGET"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_REVIEW_APPOINTMENT_DIRECTION"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "reviews"`);
    }
}
