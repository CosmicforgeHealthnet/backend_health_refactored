/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class UpdateUserTierEnum1758000000000 {
  name = 'UpdateUserTierEnum1758000000000'
  async up(queryRunner) {
    // Add 'standard' value to the existing users_tier_enum
    await queryRunner.query(`
      ALTER TYPE users_tier_enum ADD VALUE IF NOT EXISTS 'standard'
    `);
    
    // Also add other missing values if they don't exist
    await queryRunner.query(`
      ALTER TYPE users_tier_enum ADD VALUE IF NOT EXISTS 'gold_elite'
    `);
    
    await queryRunner.query(`
      ALTER TYPE users_tier_enum ADD VALUE IF NOT EXISTS 'professional'
    `);
  }

  async down(queryRunner) {
    // PostgreSQL doesn't support removing enum values directly
    // This would require recreating the enum and updating all references
    console.log('Cannot remove enum values in PostgreSQL. Manual intervention required if rollback needed.');
  }
};
