/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class FixProfessionalLicensesNullValues1748950088757 {
  async up(queryRunner) {
    // Handle medicalLicenseNumber null values
    await queryRunner.query(`
      UPDATE "professional_licenses" 
      SET "medicalLicenseNumber" = 'PENDING' 
      WHERE "medicalLicenseNumber" IS NULL
    `);
    
    // Handle countryOfLicense null values
    await queryRunner.query(`
      UPDATE "professional_licenses" 
      SET "countryOfLicense" = 'UNKNOWN' 
      WHERE "countryOfLicense" IS NULL
    `);
    
    // Handle licenseAuthority null values
    await queryRunner.query(`
      UPDATE "professional_licenses" 
      SET "licenseAuthority" = 'UNKNOWN_AUTHORITY' 
      WHERE "licenseAuthority" IS NULL
    `);
    
    // Make medicalLicenseNumber non-nullable
    await queryRunner.query(`
      ALTER TABLE "professional_licenses" 
      ALTER COLUMN "medicalLicenseNumber" SET NOT NULL
    `);
    
    // Make countryOfLicense non-nullable
    await queryRunner.query(`
      ALTER TABLE "professional_licenses" 
      ALTER COLUMN "countryOfLicense" SET NOT NULL
    `);
    
    // Make licenseAuthority non-nullable
    await queryRunner.query(`
      ALTER TABLE "professional_licenses" 
      ALTER COLUMN "licenseAuthority" SET NOT NULL
    `);
  }

  async down(queryRunner) {
    // Reverse the non-null constraints
    await queryRunner.query(`
      ALTER TABLE "professional_licenses" 
      ALTER COLUMN "medicalLicenseNumber" DROP NOT NULL
    `);
    
    await queryRunner.query(`
      ALTER TABLE "professional_licenses" 
      ALTER COLUMN "countryOfLicense" DROP NOT NULL
    `);
    
    await queryRunner.query(`
      ALTER TABLE "professional_licenses" 
      ALTER COLUMN "licenseAuthority" DROP NOT NULL
    `);
  }
};