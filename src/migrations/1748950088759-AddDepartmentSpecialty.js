/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddDepartmentSpecialty1748950088759 {
  async up(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "departmentSpecialty" varchar NULL
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN "departmentSpecialty"
    `);
  }
};