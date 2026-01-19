/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class UpdateCountryOfLicense1748950088756 {
  async up(queryRunner) {
    // First, handle existing null values
    await queryRunner.query(`
      UPDATE "professional_licenses" 
      SET "countryOfLicense" = 'UNKNOWN' 
      WHERE "countryOfLicense" IS NULL
    `);
    
    // Then make the column non-nullable
    await queryRunner.query(`
      ALTER TABLE "professional_licenses" 
      ALTER COLUMN "countryOfLicense" SET NOT NULL
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "professional_licenses" 
      ALTER COLUMN "countryOfLicense" DROP NOT NULL
    `);
  }
};