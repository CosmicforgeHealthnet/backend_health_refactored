/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * Adds a per-day "minimumNoticeMinutes" column to doctor_availability so each
 * doctor controls how far in advance a patient must book — replacing the
 * previous hardcoded 60-minute buffer in doctorAvailabilityService.js, which
 * applied to every doctor regardless of preference. Defaults to 0 (bookable
 * up to the last minute) so existing rows keep today's "no buffer" behavior.
 *
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddMinimumNoticeToDoctorAvailability1900000000061 {
    name = 'AddMinimumNoticeToDoctorAvailability1900000000061'

    async up(queryRunner) {
        await queryRunner.query(`
            ALTER TABLE "doctor_availability"
            ADD COLUMN "minimumNoticeMinutes" integer NOT NULL DEFAULT 0
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`
            ALTER TABLE "doctor_availability"
            DROP COLUMN IF EXISTS "minimumNoticeMinutes"
        `);
    }
}
