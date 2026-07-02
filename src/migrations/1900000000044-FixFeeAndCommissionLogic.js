/**
 * Migration: Fix fee and commission logic across vendor orders.
 *
 * Business rules corrected:
 *  - Platform fee (7%) is added ON TOP of subtotal — customer pays it, NOT deducted from vendor.
 *  - Vendor commission is deducted from vendor earnings (rate TBD, default 0).
 *  - Pharmacies are exempt from commission and platform fee.
 *
 * Adds:
 *  - vendor_orders.grossAmount       (subtotal + platformFeeAmount — what customer pays)
 *  - vendor_orders.commissionRate    (0–1 decimal, default 0 until confirmed)
 *  - vendor_orders.commissionAmount  (subtotal * commissionRate)
 *
 * Backfills existing rows so grossAmount = subtotal (legacy rows had no platform fee added on top).
 */
module.exports = class FixFeeAndCommissionLogic1900000000044 {
    name = "FixFeeAndCommissionLogic1900000000044";

    async up(queryRunner) {

        // ── vendor_orders: add grossAmount, commissionRate, commissionAmount ──────
        await queryRunner.query(`
            ALTER TABLE "vendor_orders"
            ADD COLUMN IF NOT EXISTS "grossAmount"      NUMERIC(14,4) DEFAULT 0 NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "vendor_orders"
            ADD COLUMN IF NOT EXISTS "commissionRate"   NUMERIC(5,4)  DEFAULT 0 NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "vendor_orders"
            ADD COLUMN IF NOT EXISTS "commissionAmount" NUMERIC(14,4) DEFAULT 0 NOT NULL
        `);

        // Backfill existing rows:
        //   grossAmount      = subtotal (legacy rows: no fee added on top)
        //   vendorAmount     = subtotal (legacy rows: vendor should have received full subtotal)
        //   platformFeeAmount = 0 (legacy rows: fee was wrongly deducted — zero it out)
        await queryRunner.query(`
            UPDATE "vendor_orders"
            SET
                "grossAmount"       = "subtotal",
                "vendorAmount"      = "subtotal",
                "platformFeeAmount" = 0,
                "commissionRate"    = 0,
                "commissionAmount"  = 0
            WHERE "grossAmount" = 0
        `);

        console.log("✅ Migration FixFeeAndCommissionLogic completed successfully.");
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "vendor_orders" DROP COLUMN IF EXISTS "commissionAmount"`);
        await queryRunner.query(`ALTER TABLE "vendor_orders" DROP COLUMN IF EXISTS "commissionRate"`);
        await queryRunner.query(`ALTER TABLE "vendor_orders" DROP COLUMN IF EXISTS "grossAmount"`);
    }
};
