/**
 * One-off script: run migration 1900000000047 (cart prescriptionId + paid status)
 * Usage (on the server):
 *   docker exec cosmic_backend_dev node scripts/run-migration-047.js
 */
require("dotenv").config();
const AppDataSource = require("../src/config/database");

async function run() {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();

  try {
    console.log("Running migration 047 — AddCartPrescriptionLink...");

    await qr.query(`
      DO $$ BEGIN
        ALTER TYPE "carts_status_enum" ADD VALUE IF NOT EXISTS 'paid';
      EXCEPTION WHEN others THEN null; END $$
    `);
    console.log("  ✅ Added 'paid' to carts_status_enum");

    await qr.query(`
      ALTER TABLE "carts"
        ADD COLUMN IF NOT EXISTS "prescriptionId" UUID NULL,
        ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP NULL
    `);
    console.log("  ✅ Added prescriptionId and paidAt columns to carts");

    console.log("Migration 047 complete.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

run();
