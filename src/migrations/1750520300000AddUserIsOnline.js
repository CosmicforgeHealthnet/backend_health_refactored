/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddUserIsOnline1750520300000 {
    name = 'AddUserIsOnline1750520300000'

    async up(queryRunner) {
        // Check if isOnline column exists
        const columnExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'users' 
                AND column_name = 'isOnline'
            )
        `);
        
        if (!columnExists[0].exists) {
            // Add isOnline column to users table
            await queryRunner.query(`ALTER TABLE "users" ADD "isOnline" BOOLEAN NOT NULL DEFAULT false`);
            
            // Add index for performance
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_isOnline" ON "users" ("isOnline")`);
            
            // Add comment
            await queryRunner.query(`COMMENT ON COLUMN "users"."isOnline" IS 'Tracks user online status'`);
        }
    }

    async down(queryRunner) {
        // Drop index
        await queryRunner.query(`DROP INDEX "public"."IDX_users_isOnline"`);
        
        // Drop column
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isOnline"`);
    }
}