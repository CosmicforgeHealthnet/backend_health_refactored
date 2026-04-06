/**
 * Migration: PricingFeeTypeToVarchar
 * Converts pharmacy_pricing.feeType from a restricted enum to varchar(100)
 * so pharmacies can set any custom fee type (e.g. "just_calling", "home_delivery", etc.)
 */
module.exports = class PricingFeeTypeToVarchar1761300000000 {
  name = "PricingFeeTypeToVarchar1761300000000";

  async up(queryRunner) {
    // Cast existing enum values to text, drop enum, use varchar
    await queryRunner.query(`
      ALTER TABLE "pharmacy_pricing"
        ALTER COLUMN "feeType" TYPE varchar(100)
        USING "feeType"::text
    `);

    // Drop the now-unused enum type
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."pharmacy_pricing_feetype_enum"
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      CREATE TYPE "public"."pharmacy_pricing_feetype_enum"
        AS ENUM('delivery', 'consultation', 'handling', 'processing')
    `);
    await queryRunner.query(`
      ALTER TABLE "pharmacy_pricing"
        ALTER COLUMN "feeType" TYPE "public"."pharmacy_pricing_feetype_enum"
        USING "feeType"::"public"."pharmacy_pricing_feetype_enum"
    `);
  }
};
