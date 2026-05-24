module.exports = class AddLoginAttemptColumnsToUsers1900000000036 {
    name = 'AddLoginAttemptColumnsToUsers1900000000036';

    async up(queryRunner) {
        await queryRunner.query(`
            ALTER TABLE "users"
                ADD COLUMN IF NOT EXISTS "loginAttempts" int NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "lockedUntil"   TIMESTAMP DEFAULT NULL
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_users_lockedUntil" ON "users" ("lockedUntil")
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_lockedUntil"`);
        await queryRunner.query(`
            ALTER TABLE "users"
                DROP COLUMN IF EXISTS "lockedUntil",
                DROP COLUMN IF EXISTS "loginAttempts"
        `);
    }
};
