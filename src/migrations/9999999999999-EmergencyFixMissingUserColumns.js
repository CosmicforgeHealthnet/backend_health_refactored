// const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class EmergencyFixMissingUserColumns9999999999999 {
  name = "EmergencyFixMissingUserColumns9999999999999";

  async up(queryRunner) {
    console.log('🚀 Starting Emergency Migration: Adding missing columns to "users" table...');

    // 1. Add missing columns with IF NOT EXISTS
    const columns = [
      { name: "username", type: "character varying" },
      { name: "bannerUrl", type: "character varying" },
      { name: "country", type: "character varying(100)" },
      { name: "pharmacyId", type: "uuid" },
      { name: "phoneNumber", type: "character varying" },
      { name: "departmentSpecialty", type: "character varying" },
      { name: "providerId", type: "character varying" },
      { name: "profileImageUrl", type: "character varying" },
      { name: "mfaEnabled", type: "boolean", default: "false" },
      { name: "mfaSecret", type: "character varying" },
      { name: "isOnline", type: "boolean", default: "false" },
      { name: "referralCode", type: "character varying(50)" },
      { name: "totalReferrals", type: "integer", default: "0" },
      { name: "referredBy", type: "uuid" },
      { name: "timezone", type: "character varying(100)" },
      { name: "lastDetectedTimezone", type: "character varying(100)" },
      { name: "timezoneUpdatedAt", type: "TIMESTAMP" },
      { name: "averageRating", type: "numeric(2,1)", default: "0.0" },
      { name: "totalRatings", type: "integer", default: "0" }
    ];

    for (const col of columns) {
      try {
        await queryRunner.query(`
          ALTER TABLE "users" 
          ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type} 
          ${col.default !== undefined ? "DEFAULT " + col.default : ""}
        `);
        console.log(`✅ Column "${col.name}" checked/added.`);
      } catch (err) {
        console.error(`❌ Failed to add column "${col.name}":`, err.message);
      }
    }

    // 2. Handle Enums separately if needed (though they usually exist)
    // We'll ensure 'provider' exists as character varying if it was missing
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider" character varying DEFAULT 'local'
    `).catch(() => {});

    // 3. Ensure Unique Constraints
    await queryRunner.query(`
      DO $$
      BEGIN
        -- Unique Email (usually handled but let's be safe)
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_users_email') THEN
          ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email");
        END IF;

        -- Unique Username
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_users_username') THEN
          ALTER TABLE "users" ADD CONSTRAINT "UQ_users_username" UNIQUE ("username");
        END IF;

        -- Unique Referral Code
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_users_referralCode') THEN
          ALTER TABLE "users" ADD CONSTRAINT "UQ_users_referralCode" UNIQUE ("referralCode");
        END IF;
      END
      $$
    `).catch(err => console.error('❌ Failed to add constraints:', err.message));

    // 4. Ensure Indexes
    const indexes = [
      { name: "IDX_users_email", col: "email" },
      { name: "IDX_users_username", col: "username" },
      { name: "IDX_users_role", col: "role" },
      { name: "IDX_users_status", col: "status" },
      { name: "IDX_users_isOnline", col: "isOnline" },
      { name: "IDX_users_country", col: "country" }
    ];

    for (const idx of indexes) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "${idx.name}" ON "users" ("${idx.col}")
      `).catch(() => {});
    }

    console.log('🏁 Emergency Migration completed successfully.');
  }

  async down(queryRunner) {
    // We don't want to drop columns in a down migration for an emergency state fix
  }
}
