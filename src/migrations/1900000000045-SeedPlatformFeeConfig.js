/**
 * Seed platform fee configuration into admin_settings.
 * These values are admin-controllable via GET/PUT /api/admin/ops/payment-config.
 *
 * Keys seeded:
 *   payment_config / platform_fee_rate      → 0.07  (7% added ON TOP for customer)
 *   payment_config / vendor_commission_rate → 0     (TBD — structure ready, rate to be confirmed)
 */
module.exports = class SeedPlatformFeeConfig1900000000045 {
    name = "SeedPlatformFeeConfig1900000000045";

    async up(queryRunner) {
        // Upsert so running twice is safe
        await queryRunner.query(`
            INSERT INTO "admin_settings" ("category", "key", "value")
            VALUES
                ('payment_config', 'platform_fee_rate',      '0.07'),
                ('payment_config', 'vendor_commission_rate', '0')
            ON CONFLICT ("category", "key")
            DO UPDATE SET "value" = EXCLUDED."value"
        `);

        console.log("✅ Platform fee config seeded: platform_fee_rate=0.07, vendor_commission_rate=0");
    }

    async down(queryRunner) {
        await queryRunner.query(`
            DELETE FROM "admin_settings"
            WHERE "category" = 'payment_config'
            AND "key" IN ('platform_fee_rate', 'vendor_commission_rate')
        `);
    }
};
