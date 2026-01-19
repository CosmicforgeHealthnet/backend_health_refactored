/**
 * Optimized batch subscription migration
 * Much faster than row-by-row processing
 */

module.exports = class FastSubscriptionSync1758000000002 {
    name = 'FastSubscriptionSync1758000000002'

    async up(queryRunner) {
        console.log('🚀 Starting optimized batch subscription sync...');

        // Batch create all missing subscriptions in one query
        await queryRunner.query(`
            INSERT INTO subscriptions (
                "userId", "tier", "planType", "status", "startDate", "endDate", 
                "price", "currency", "autoRenew", "commissionRate", "features", 
                "monthlyLimits", "currentUsage", "familyMembers", "billingCycle", 
                "metadata", "createdAt", "updatedAt"
            )
            SELECT 
                u.id as "userId",
                COALESCE(u.tier::text, 'free')::subscriptions_tier_enum as "tier",
                CASE WHEN u.role = 'doctor' THEN 'doctor'::subscriptions_plantype_enum 
                     ELSE 'patient'::subscriptions_plantype_enum END as "planType",
                'active'::subscriptions_status_enum as "status",
                NOW() as "startDate",
                NOW() + INTERVAL '1 year' as "endDate",
                0 as "price",
                'USD' as "currency",
                false as "autoRenew",
                CASE WHEN u.role = 'doctor' THEN 30.0 ELSE NULL END as "commissionRate",
                CASE 
                    WHEN u.role = 'doctor' THEN '{"chatOnly": true, "regularProfileListing": true, "standardSupport": true}'::jsonb
                    ELSE '{"chatOnly": true, "generalEmergencySpecialists": true, "standardSupport": true}'::jsonb
                END as "features",
                CASE 
                    WHEN u.role = 'doctor' THEN '{"aiDiagnosticRequests": 10, "maxPatients": 50}'::jsonb
                    ELSE '{"aiDiagnosticRequests": 5}'::jsonb
                END as "monthlyLimits",
                '{}'::jsonb as "currentUsage",
                1 as "familyMembers",
                'monthly'::subscriptions_billingcycle_enum as "billingCycle",
                ('{"createdByFastMigration": true, "migrationDate": "' || NOW()::text || '"}')::jsonb as "metadata",
                NOW() as "createdAt",
                NOW() as "updatedAt"
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s."userId" AND s.status = 'active'
            WHERE s.id IS NULL AND u.id IS NOT NULL
        `);

        const result = await queryRunner.query(`
            SELECT COUNT(*) as count 
            FROM subscriptions 
            WHERE metadata->>'createdByFastMigration' = 'true'
        `);

        console.log(`✅ Created ${result[0].count} subscription records in batch`);
    }

    async down(queryRunner) {
        await queryRunner.query(`
            DELETE FROM subscriptions 
            WHERE metadata->>'createdByFastMigration' = 'true'
        `);
    }
}