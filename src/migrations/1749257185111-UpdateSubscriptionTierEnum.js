/**
* @typedef {import('typeorm').MigrationInterface} MigrationInterface
*/

/**
* @class
* @implements {MigrationInterface}
*/
module.exports = class UpdateSubscriptionTierEnum1749257185111 {
 async up(queryRunner) {
   // Add new enum values to the existing subscriptions_tier_enum
   await queryRunner.query(`
     ALTER TYPE subscriptions_tier_enum ADD VALUE IF NOT EXISTS 'standard'
   `);
   await queryRunner.query(`
     ALTER TYPE subscriptions_tier_enum ADD VALUE IF NOT EXISTS 'medium'
   `);
   await queryRunner.query(`
     ALTER TYPE subscriptions_tier_enum ADD VALUE IF NOT EXISTS 'premium'
   `);
   await queryRunner.query(`
     ALTER TYPE subscriptions_tier_enum ADD VALUE IF NOT EXISTS 'gold_elite'
   `);
   await queryRunner.query(`
     ALTER TYPE subscriptions_tier_enum ADD VALUE IF NOT EXISTS 'professional'
   `);
 }

 async down(queryRunner) {
   // PostgreSQL doesn't support removing enum values directly
   // This would require recreating the enum and updating all references
   console.log('Cannot remove enum values in PostgreSQL. Manual intervention required if rollback needed.');
 }
};
