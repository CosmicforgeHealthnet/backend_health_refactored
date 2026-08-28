/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * Adds latitude/longitude and delivery/pickup availability to pharmacy and
 * vendor profiles, needed for the patient dashboard's nearby-vendors
 * discovery endpoint (GET /api/patient/nearby-vendors/). Neither table had
 * any geo columns before this — distance can't be computed without them.
 *
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddVendorPharmacyGeolocation1900000000058 {
    name = 'AddVendorPharmacyGeolocation1900000000058'

    async up(queryRunner) {
        await queryRunner.query(`
            ALTER TABLE "pharmacy_profiles"
            ADD COLUMN "latitude" DECIMAL(10,7) NULL,
            ADD COLUMN "longitude" DECIMAL(10,7) NULL,
            ADD COLUMN "deliveryAvailable" BOOLEAN NOT NULL DEFAULT true,
            ADD COLUMN "pickupAvailable" BOOLEAN NOT NULL DEFAULT true
        `);

        await queryRunner.query(`
            ALTER TABLE "vendor_profiles"
            ADD COLUMN "latitude" DECIMAL(10,7) NULL,
            ADD COLUMN "longitude" DECIMAL(10,7) NULL,
            ADD COLUMN "deliveryAvailable" BOOLEAN NOT NULL DEFAULT true,
            ADD COLUMN "pickupAvailable" BOOLEAN NOT NULL DEFAULT true
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_PHARMACY_PROFILE_GEO" ON "pharmacy_profiles" ("latitude", "longitude")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_VENDOR_PROFILE_GEO" ON "vendor_profiles" ("latitude", "longitude")
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PHARMACY_PROFILE_GEO"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_VENDOR_PROFILE_GEO"`);

        await queryRunner.query(`
            ALTER TABLE "pharmacy_profiles"
            DROP COLUMN IF EXISTS "latitude",
            DROP COLUMN IF EXISTS "longitude",
            DROP COLUMN IF EXISTS "deliveryAvailable",
            DROP COLUMN IF EXISTS "pickupAvailable"
        `);

        await queryRunner.query(`
            ALTER TABLE "vendor_profiles"
            DROP COLUMN IF EXISTS "latitude",
            DROP COLUMN IF EXISTS "longitude",
            DROP COLUMN IF EXISTS "deliveryAvailable",
            DROP COLUMN IF EXISTS "pickupAvailable"
        `);
    }
}
