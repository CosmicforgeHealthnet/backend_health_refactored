/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AdditionofLocationforPatient1758796045366 {
    name = 'AdditionofLocationforPatient1758796045366'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" ADD "country" character varying(100)`);
        await queryRunner.query(`COMMENT ON COLUMN "users"."country" IS 'User''s country detected during signup (for patient restrictions)'`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_82d2ea5f3f8a99449e541918b5" ON "users" ("country") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."IDX_82d2ea5f3f8a99449e541918b5"`);
        await queryRunner.query(`COMMENT ON COLUMN "users"."country" IS 'User''s country detected during signup (for patient restrictions)'`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "country"`);
    }
}
