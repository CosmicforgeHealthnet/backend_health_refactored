/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class PhoneNUmberForDoctors1758131286123 {
    name = 'PhoneNUmberForDoctors1758131286123'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" ADD "phoneNumber" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "users"."phoneNumber" IS 'Phone number for doctors (optional)'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`COMMENT ON COLUMN "users"."phoneNumber" IS 'Phone number for doctors (optional)'`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phoneNumber"`);
    }
}
