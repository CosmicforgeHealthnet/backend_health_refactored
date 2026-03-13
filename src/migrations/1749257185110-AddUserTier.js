/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddUserTier1749257185110 {
  async up(queryRunner) {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE user_tier_enum AS ENUM ('free', 'basic', 'medium', 'premium');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS tier user_tier_enum NOT NULL DEFAULT 'free'
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN tier
    `);
  }
};
