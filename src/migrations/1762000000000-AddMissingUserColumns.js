/**
 * Safe migration: adds all columns defined in the User entity that may be
 * missing from the DB. Every ALTER uses IF NOT EXISTS so it's idempotent.
 */
module.exports = class AddMissingUserColumns1762000000000 {
  name = 'AddMissingUserColumns1762000000000';

  async up(queryRunner) {
    // Helper: only adds a column when it doesn't already exist
    const addCol = (col, definition) => queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS ${col} ${definition};
    `);

    // Helper: only creates an index when it doesn't already exist
    const addIdx = (name, col) => queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "${name}" ON "users" ("${col}");
    `);

    // ── Pharmacy / profile fields ─────────────────────────────────────────
    await addCol('"username"',         'VARCHAR UNIQUE DEFAULT NULL');
    await addCol('"bannerUrl"',         'VARCHAR DEFAULT NULL');
    await addCol('"pharmacyId"',        'UUID DEFAULT NULL');

    // ── Location ──────────────────────────────────────────────────────────
    await addCol('"country"',           'VARCHAR(100) DEFAULT NULL');

    // ── Contact ───────────────────────────────────────────────────────────
    await addCol('"phoneNumber"',       'VARCHAR DEFAULT NULL');
    await addCol('"departmentSpecialty"', 'VARCHAR DEFAULT NULL');

    // ── Timezone ──────────────────────────────────────────────────────────
    await addCol('"timezone"',              'VARCHAR(100) DEFAULT NULL');
    await addCol('"lastDetectedTimezone"',  'VARCHAR(100) DEFAULT NULL');
    await addCol('"timezoneUpdatedAt"',     'TIMESTAMP DEFAULT NULL');

    // ── Online status ─────────────────────────────────────────────────────
    await addCol('"isOnline"', 'BOOLEAN NOT NULL DEFAULT false');

    // ── Referral ──────────────────────────────────────────────────────────
    await addCol('"referralCode"',    'VARCHAR(50) UNIQUE DEFAULT NULL');
    await addCol('"totalReferrals"',  'INTEGER NOT NULL DEFAULT 0');
    await addCol('"referredBy"',      'UUID DEFAULT NULL');

    // ── Ratings ───────────────────────────────────────────────────────────
    await addCol('"averageRating"',  'DECIMAL(2,1) NOT NULL DEFAULT 0');
    await addCol('"totalRatings"',   'INTEGER NOT NULL DEFAULT 0');

    // ── Tier enum (safe: add value then column) ───────────────────────────
    // Add any missing enum values first
    const tierValues = ['free','basic','standard','medium','premium','gold_elite','professional'];
    for (const val of tierValues) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TYPE "user_tier_enum" ADD VALUE IF NOT EXISTS '${val}';
        EXCEPTION WHEN others THEN NULL; END $$;
      `).catch(() => {}); // ignore if type doesn't exist yet
    }

    // ── Indexes ───────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_country"    ON "users" ("country")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_isOnline"   ON "users" ("isOnline")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_role"       ON "users" ("role")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_status"     ON "users" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_createdAt"  ON "users" ("createdAt")`);
  }

  async down(queryRunner) {
    const cols = [
      'username','bannerUrl','pharmacyId','country','phoneNumber',
      'departmentSpecialty','timezone','lastDetectedTimezone','timezoneUpdatedAt',
      'isOnline','referralCode','totalReferrals','referredBy','averageRating','totalRatings'
    ];
    for (const col of cols) {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "${col}"`);
    }
  }
};
