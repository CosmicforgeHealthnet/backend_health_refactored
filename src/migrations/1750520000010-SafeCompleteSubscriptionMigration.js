/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class SafeCompleteSubscriptionMigration1750520000010 {
    name = 'SafeCompleteSubscriptionMigration1750520000010'

    async up(queryRunner) {
        // Check if subscriptions table has any data
        const dataCount = await queryRunner.query(`SELECT COUNT(*) as count FROM subscriptions`);
        const hasData = parseInt(dataCount[0].count) > 0;
        
        console.log(`Subscriptions table has ${dataCount[0].count} rows`);

        if (!hasData) {
            // If no data, we can safely recreate everything
            await this.recreateEmptyTable(queryRunner);
        } else {
            // If has data, we need to be more careful
            await this.migrateWithData(queryRunner);
        }
    }

    async recreateEmptyTable(queryRunner) {
        console.log('Recreating empty subscriptions table...');
        
        // Drop the table and recreate with all correct enums
        await queryRunner.query(`DROP TABLE IF EXISTS subscriptions CASCADE`);
        
        // Drop old enums
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."subscriptions_tier_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."subscriptions_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."subscriptions_plantype_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."subscriptions_billingcycle_enum"`);

        // Create all enums
        await queryRunner.query(`
            CREATE TYPE "public"."subscriptions_tier_enum" AS ENUM(
                'basic', 'pro', 'enterprise', 'free', 'standard', 
                'medium', 'premium', 'gold_elite', 'professional'
            )
        `);
        
        await queryRunner.query(`
            CREATE TYPE "public"."subscriptions_status_enum" AS ENUM(
                'active', 'pending', 'expired', 'canceled', 'paused'
            )
        `);
        
        await queryRunner.query(`
            CREATE TYPE "public"."subscriptions_plantype_enum" AS ENUM('doctor', 'patient')
        `);
        
        await queryRunner.query(`
            CREATE TYPE "public"."subscriptions_billingcycle_enum" AS ENUM('monthly', 'quarterly', 'yearly')
        `);

        // Create the complete table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "subscriptions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "tier" "public"."subscriptions_tier_enum" NOT NULL DEFAULT 'free',
                "status" "public"."subscriptions_status_enum" NOT NULL DEFAULT 'active',
                "startDate" TIMESTAMP,
                "endDate" TIMESTAMP,
                "nextBillingDate" TIMESTAMP,
                "autoRenew" boolean NOT NULL DEFAULT false,
                "price" real,
                "currency" character varying(3) NOT NULL DEFAULT 'USD',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "planType" "public"."subscriptions_plantype_enum" DEFAULT 'patient',
                "commissionRate" numeric(5,2),
                "features" jsonb DEFAULT '[]',
                "monthlyLimits" jsonb DEFAULT '{}',
                "currentUsage" jsonb DEFAULT '{}',
                "familyMembers" integer NOT NULL DEFAULT '1',
                "originalTier" character varying,
                "billingCycle" "public"."subscriptions_billingcycle_enum" NOT NULL DEFAULT 'monthly',
                "metadata" jsonb DEFAULT '{}',
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "canceledAt" TIMESTAMP,
                "pausedAt" TIMESTAMP,
                CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id")
            )
        `);

        // Add indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_subscriptions_userId" ON "subscriptions" ("userId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_subscriptions_status" ON "subscriptions" ("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_subscriptions_tier" ON "subscriptions" ("tier")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_subscriptions_plantype" ON "subscriptions" ("planType")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_subscriptions_nextBillingDate" ON "subscriptions" ("nextBillingDate")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_subscriptions_createdAt" ON "subscriptions" ("createdAt")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_subscriptions_billingcycle" ON "subscriptions" ("billingCycle")`);

        // Add foreign key
        await queryRunner.query(`
            ALTER TABLE "subscriptions" 
            ADD CONSTRAINT "FK_subscriptions_userId" 
            FOREIGN KEY ("userId") REFERENCES "users"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        // Add comments
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."planType" IS 'Distinguishes between doctor and patient plans'`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."commissionRate" IS 'Commission rate for doctors (percentage)'`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."features" IS 'Array of enabled features for this subscription'`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."monthlyLimits" IS 'Monthly usage limits (AI responses, consultations, etc.)'`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."currentUsage" IS 'Current month usage tracking'`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."familyMembers" IS 'Number of family members allowed (for patient plans)'`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."originalTier" IS 'Track legacy tier for migration purposes'`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."metadata" IS 'Additional subscription metadata'`);
    }

    async migrateWithData(queryRunner) {
        console.log('Migrating subscriptions table with existing data...');
        
        // First, let's add a temporary column to store the old tier values
        await queryRunner.query(`ALTER TABLE subscriptions ADD COLUMN temp_tier_backup varchar`);
        await queryRunner.query(`UPDATE subscriptions SET temp_tier_backup = tier::text`);

        // Create new enum with all values
        await queryRunner.query(`
            CREATE TYPE "public"."subscriptions_tier_enum_new" AS ENUM(
                'basic', 'pro', 'enterprise', 'free', 'standard', 
                'medium', 'premium', 'gold_elite', 'professional'
            )
        `);

        // Convert column to text first, then to new enum
        await queryRunner.query(`ALTER TABLE subscriptions ALTER COLUMN tier TYPE text`);
        await queryRunner.query(`
            ALTER TABLE subscriptions 
            ALTER COLUMN tier TYPE "public"."subscriptions_tier_enum_new" 
            USING CASE 
                WHEN tier IN ('basic', 'pro', 'enterprise') THEN tier::"public"."subscriptions_tier_enum_new"
                ELSE 'free'::"public"."subscriptions_tier_enum_new"
            END
        `);

        // Drop old enum and rename new one
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."subscriptions_tier_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."subscriptions_tier_enum_new" RENAME TO "subscriptions_tier_enum"`);

        // Create other enums
        try {
            await queryRunner.query(`CREATE TYPE "public"."subscriptions_plantype_enum" AS ENUM('doctor', 'patient')`);
        } catch { /* type may already exist */ }

        try {
            await queryRunner.query(`CREATE TYPE "public"."subscriptions_billingcycle_enum" AS ENUM('monthly', 'quarterly', 'yearly')`);
        } catch { /* type may already exist */ }

        // Add new columns
        const columnsToAdd = [
            { name: "planType", type: `"public"."subscriptions_plantype_enum"`, default: "'patient'" },
            { name: "commissionRate", type: `numeric(5,2)` },
            { name: "features", type: `jsonb`, default: "'[]'" },
            { name: "monthlyLimits", type: `jsonb`, default: "'{}'" },
            { name: "currentUsage", type: `jsonb`, default: "'{}'" },
            { name: "familyMembers", type: `integer`, default: "1" },
            { name: "originalTier", type: `character varying` },
            { name: "billingCycle", type: `"public"."subscriptions_billingcycle_enum"`, default: "'monthly'" },
            { name: "metadata", type: `jsonb`, default: "'{}'" },
            { name: "updatedAt", type: `TIMESTAMP`, default: "now()" },
            { name: "canceledAt", type: `TIMESTAMP` },
            { name: "pausedAt", type: `TIMESTAMP` }
        ];
        
        for (const column of columnsToAdd) {
            const hasColumn = await queryRunner.hasColumn("subscriptions", column.name);
            if (!hasColumn) {
                let query = `ALTER TABLE "subscriptions" ADD "${column.name}" ${column.type}`;
                if (column.default) {
                    query += ` DEFAULT ${column.default}`;
                }
                await queryRunner.query(query);
            }
        }

        // Update original tier from backup
        await queryRunner.query(`UPDATE subscriptions SET "originalTier" = temp_tier_backup`);
        await queryRunner.query(`ALTER TABLE subscriptions DROP COLUMN temp_tier_backup`);

        // Add indexes
        const indexes = [
            "IDX_subscriptions_plantype",
            "IDX_subscriptions_billingcycle"
        ];

        for (const indexName of indexes) {
            try {
                const columnName = indexName.split('_').pop();
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "subscriptions" ("${columnName}")`);
            } catch (e) {
                // Index might already exist
            }
        }
    }

    async down(queryRunner) {
        // This is a destructive operation - recreate basic table
        await queryRunner.query(`DROP TABLE IF EXISTS subscriptions CASCADE`);
        
        await queryRunner.query(`CREATE TYPE "public"."subscriptions_tier_enum" AS ENUM('basic', 'pro', 'enterprise')`);
        await queryRunner.query(`CREATE TYPE "public"."subscriptions_status_enum" AS ENUM('active', 'pending', 'expired', 'canceled', 'paused')`);
        
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "subscriptions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "tier" "public"."subscriptions_tier_enum" NOT NULL DEFAULT 'basic',
                "status" "public"."subscriptions_status_enum" NOT NULL DEFAULT 'active',
                "startDate" TIMESTAMP,
                "endDate" TIMESTAMP,
                "nextBillingDate" TIMESTAMP,
                "autoRenew" boolean NOT NULL DEFAULT false,
                "price" real,
                "currency" character varying(3) NOT NULL DEFAULT 'USD',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id")
            )
        `);
    }
}