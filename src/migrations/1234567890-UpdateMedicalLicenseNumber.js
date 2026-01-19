/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class UpdateMedicalLicenseNumber1748950088755 {
  async up(queryRunner) {
    // First, handle existing null values
    await queryRunner.query(`
      UPDATE "professional_licenses" 
      SET "medicalLicenseNumber" = 'PENDING' 
      WHERE "medicalLicenseNumber" IS NULL
    `);
    
    // Then make the column non-nullable
    await queryRunner.query(`
      ALTER TABLE "professional_licenses" 
      ALTER COLUMN "medicalLicenseNumber" SET NOT NULL
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "professional_licenses" 
      ALTER COLUMN "medicalLicenseNumber" DROP NOT NULL
    `);
  }
};