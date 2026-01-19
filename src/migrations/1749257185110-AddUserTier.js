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
      ALTER TABLE users
      ADD COLUMN tier ENUM('free', 'basic', 'medium', 'premium') NOT NULL DEFAULT 'free'
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN tier
    `);
  }
};
