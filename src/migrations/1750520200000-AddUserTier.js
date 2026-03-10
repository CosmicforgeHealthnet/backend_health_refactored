/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddUserTier1750520200000 {
    name = 'AddUserTier1750520200000'

    async up(queryRunner) {
        // Check if tier column exists first
        const columnExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'users' 
                AND column_name = 'tier'
            )
        `);
        
        if (!columnExists[0].exists) {
            // Add tier column to users table
            await queryRunner.query(`ALTER TABLE "users" ADD "tier" "public"."users_tier_enum" NOT NULL DEFAULT 'free'`);
            
            // Add index for performance
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_tier" ON "users" ("tier")`);
            
            // Add comment
            await queryRunner.query(`COMMENT ON COLUMN "users"."tier" IS 'User subscription tier level'`);
        }
    }

    async down(queryRunner) {
        // Drop index
        await queryRunner.query(`DROP INDEX "public"."IDX_users_tier"`);
        
        // Drop column
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "tier"`);
        
        // Drop enum type
        await queryRunner.query(`DROP TYPE "public"."users_tier_enum"`);
    }
}