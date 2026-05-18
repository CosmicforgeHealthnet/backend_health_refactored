const AppDataSource = require('../src/config/database');

const sql = `
DO $$ BEGIN
  CREATE TYPE "users_provider_enum" AS ENUM ('local','google');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider"   "users_provider_enum" NOT NULL DEFAULT 'local';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "providerId" VARCHAR DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaSecret"  VARCHAR DEFAULT NULL;

CREATE INDEX IF NOT EXISTS "IDX_users_provider" ON "users" ("provider");
`;

(async () => {
  try {
    await AppDataSource.initialize();
    console.log('Adding provider / providerId / mfaEnabled / mfaSecret...');
    await AppDataSource.query(sql);
    const rows = await AppDataSource.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN ('provider','providerId','mfaEnabled','mfaSecret')
      ORDER BY column_name;
    `);
    console.log('Present now:');
    rows.forEach(r => console.log(` - ${r.column_name}`));
    await AppDataSource.destroy();
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exit(1);
  }
})();
