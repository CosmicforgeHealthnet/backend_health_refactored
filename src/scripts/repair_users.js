/**
 * COMPREHENSIVE REPAIR SCRIPT
 * 1. Patches Database Schema (adds missing columns)
 * 2. Restores user roles and statuses
 */
const AppDataSource = require("../config/database");

async function repair() {
    console.log("🚀 Starting comprehensive database repair...");
    
    try {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }
        console.log("✅ Database connected.");

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        // PART 1: Schema Patching
        console.log("🛠 Patching database schema...");
        
        // Comprehensive User Table Hardening
        console.log("👤 Hardening 'users' table (adding all missing columns)...");
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "username" character varying,
            ADD COLUMN IF NOT EXISTS "bannerUrl" character varying,
            ADD COLUMN IF NOT EXISTS "country" character varying(100),
            ADD COLUMN IF NOT EXISTS "pharmacyId" uuid,
            ADD COLUMN IF NOT EXISTS "departmentSpecialty" character varying,
            ADD COLUMN IF NOT EXISTS "provider" character varying DEFAULT 'local',
            ADD COLUMN IF NOT EXISTS "providerId" character varying,
            ADD COLUMN IF NOT EXISTS "profileImageUrl" character varying,
            ADD COLUMN IF NOT EXISTS "mfaEnabled" boolean DEFAULT false,
            ADD COLUMN IF NOT EXISTS "mfaSecret" character varying,
            ADD COLUMN IF NOT EXISTS "isOnline" boolean DEFAULT false,
            ADD COLUMN IF NOT EXISTS "referralCode" character varying(50),
            ADD COLUMN IF NOT EXISTS "totalReferrals" integer DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "referredBy" uuid,
            ADD COLUMN IF NOT EXISTS "timezone" character varying(100),
            ADD COLUMN IF NOT EXISTS "lastDetectedTimezone" character varying(100),
            ADD COLUMN IF NOT EXISTS "timezoneUpdatedAt" TIMESTAMP,
            ADD COLUMN IF NOT EXISTS "averageRating" numeric(2,1) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "totalRatings" integer DEFAULT 0;
        `);

        // Sync departmentSpecialty from professional_licenses for doctors
        console.log("🔄 Syncing departmentSpecialty from professional_licenses...");
        await queryRunner.query(`
            UPDATE "users" u
            SET "departmentSpecialty" = pl.subspecialty
            FROM "doctor_profiles" dp
            JOIN "professional_licenses" pl ON dp."id" = pl."doctorProfileId"
            WHERE u."id" = dp."userId"
            AND (u."departmentSpecialty" IS NULL OR u."departmentSpecialty" = '')
            AND pl.subspecialty IS NOT NULL;
        `);
        
        // Add Constraints & Indices
        console.log("🔗 Adding constraints and indices...");
        try {
            await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_username" UNIQUE ("username");`);
            console.log("✅ Added unique constraint to 'username'.");
        } catch (e) { /* ignore */ }
        
        try {
            await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_user_referral_code" UNIQUE ("referralCode");`);
            console.log("✅ Added unique constraint to 'referralCode'.");
        } catch (e) { /* ignore */ }

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_username" ON "users" ("username")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_country" ON "users" ("country")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_pharmacyId" ON "users" ("pharmacyId")`);

        // Add feeType to pharmacy_pricing
        console.log("💊 Adding 'feeType' to 'pharmacy_pricing' table if missing...");
        await queryRunner.query(`
            ALTER TABLE "pharmacy_pricing" 
            ADD COLUMN IF NOT EXISTS "feeType" varchar DEFAULT 'general';
        `);

        console.log("✅ Schema patched.");

        // PART 2: Data Restoration
        console.log("🩺 Restoring Doctor roles...");
        // NOTE: this used to also force-set status = 'doctor_active' for every user
        // with a doctor_profiles row, regardless of their actual verification outcome
        // (verification_requests.status). That desynced users.status from the real
        // verification decision for doctors who were never approved (or were rejected),
        // which is exactly the "verification status inconsistent" bug fixed on
        // 2026-08-25 via src/scripts/reconcile_doctor_verification_status.js.
        // Status is intentionally left untouched here — only doctorVerificationService's
        // approve/reject flow (and the reconciliation script) should ever set it.
        const doctorsToRestore = await queryRunner.query(`
            SELECT COUNT(*) FROM "users"
            WHERE "id" IN (SELECT "userId" FROM "doctor_profiles")
            AND "role" != 'doctor';
        `);

        const doctorUpdate = await queryRunner.query(`
            UPDATE "users"
            SET "role" = 'doctor'
            WHERE "id" IN (SELECT "userId" FROM "doctor_profiles")
            AND "role" != 'doctor';
        `);
        console.log(`✅ Restored doctor roles (affected rows: ${doctorUpdate[1] || 'check database'})`);

        console.log("💊 Checking for misplaced Pharmacy staff...");
        const pharmacyUpdate = await queryRunner.query(`
            UPDATE "users" 
            SET "role" = 'pharmacy', "status" = 'active' 
            WHERE "pharmacyId" IS NOT NULL AND "role" = 'patient';
        `);
        console.log(`✅ Restored pharmacy (affected rows: ${pharmacyUpdate[1] || 'check database'})`);

        // PART 3: Performance & Wallets
        console.log("⚡ Optimizing Notification table performance...");
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_NOTIFICATION_USER" ON "notification" ("userId");
            CREATE INDEX IF NOT EXISTS "IDX_NOTIFICATION_CREATED_AT" ON "notification" ("createdAt");
            CREATE INDEX IF NOT EXISTS "IDX_NOTIFICATION_USER_READ" ON "notification" ("userId", "isRead", "isDeleted");
        `);
        console.log("✅ Notification indexes applied.");

        console.log("💰 Ensuring all doctors have wallets...");
        // This is a bit more complex, we'll use a single query to insert missing wallets
        const walletCount = await queryRunner.query(`
            INSERT INTO "doctor_wallets" ("doctorId", "totalBalanceUsd", "pendingCreditsUsd", "availableBalanceUsd", "preferredDisplayCurrency")
            SELECT u.id, 0.00, 0.00, 0.00, 'USD'
            FROM "users" u
            WHERE u.role IN ('doctor', 'specialist')
            AND NOT EXISTS (
                SELECT 1 FROM "doctor_wallets" w WHERE w."doctorId" = u.id
            );
        `);
        console.log(`✅ Doctor wallets verified/created (new wallets: ${walletCount[1] || '0'})`);

        await queryRunner.release();
        console.log("✨ Comprehensive repair complete!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Repair failed:", error);
        process.exit(1);
    }
}

repair();
