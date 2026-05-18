#!/usr/bin/env node

require("reflect-metadata");

const config = require("../src/config");
const AppDataSource = require("../src/config/database");

async function main() {
  if (config.nodeEnv !== "production" && process.env.ALLOW_NON_PROD_LAST_LOGIN_HOTFIX !== "true") {
    throw new Error(
      "Refusing to run outside production. Set NODE_ENV=production, or set ALLOW_NON_PROD_LAST_LOGIN_HOTFIX=true for a non-production check."
    );
  }

  console.log(
    `Applying lastLoginAt hotfix to ${config.nodeEnv} DB ${config.db.host}:${config.db.port}/${config.db.database}`
  );

  await AppDataSource.initialize();

  await AppDataSource.query(`
    ALTER TABLE public."users"
      ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP
  `);

  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_users_lastLoginAt"
      ON public."users" ("lastLoginAt")
  `);

  const [result] = await AppDataSource.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'lastLoginAt'
    ) AS exists
  `);

  console.log(`users.lastLoginAt exists: ${result.exists}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });
