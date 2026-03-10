/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class EnhancedTransactionFields1750519500000 {
    name = 'EnhancedTransactionFields1750519500000'

    async up(queryRunner) {
        // Add appointment date field
        await queryRunner.query(`ALTER TABLE "transactions" ADD "appointmentDate" TIMESTAMP`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions"."appointmentDate" IS 'Date of appointment (for appointment payments)'`);

        // Add dispute window starts at field
        await queryRunner.query(`ALTER TABLE "transactions" ADD "disputeWindowStartsAt" TIMESTAMP`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions"."disputeWindowStartsAt" IS 'When dispute window actually starts (appointmentDate for appointments, completedAt for others)'`);

        // Update existing disputeWindowEndsAt comment
        await queryRunner.query(`COMMENT ON COLUMN "transactions"."disputeWindowEndsAt" IS 'When 3-day dispute window ends (disputeWindowStartsAt + 3 days)'`);

        // Create enum type for fundsStatus
        await queryRunner.query(`CREATE TYPE "public"."transactions_fundsstatus_enum" AS ENUM('pending_appointment', 'pending_dispute', 'releasable', 'released')`);
        
        // Add fundsStatus field with default value
        await queryRunner.query(`ALTER TABLE "transactions" ADD "fundsStatus" "public"."transactions_fundsstatus_enum" NOT NULL DEFAULT 'pending_appointment'`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions"."fundsStatus" IS 'Status of funds for doctor access'`);

        // Add cancellation fields
        await queryRunner.query(`ALTER TABLE "transactions" ADD "isCancelled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions"."isCancelled" IS 'Whether appointment was cancelled'`);

        await queryRunner.query(`ALTER TABLE "transactions" ADD "cancelledAt" TIMESTAMP`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions"."cancelledAt" IS 'When cancellation was processed by payment system'`);

        // Create enum type for refundStatus
        await queryRunner.query(`CREATE TYPE "public"."transactions_refundstatus_enum" AS ENUM('none', 'pending', 'partial', 'full', 'failed')`);
        
        // Add refund fields
        await queryRunner.query(`ALTER TABLE "transactions" ADD "refundStatus" "public"."transactions_refundstatus_enum" NOT NULL DEFAULT 'none'`);
        
        await queryRunner.query(`ALTER TABLE "transactions" ADD "refundAmount" numeric(10,2)`);
        
        await queryRunner.query(`ALTER TABLE "transactions" ADD "refundProcessedAt" TIMESTAMP`);

        // Add rescheduling fields
        await queryRunner.query(`ALTER TABLE "transactions" ADD "originalAppointmentDate" TIMESTAMP`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions"."originalAppointmentDate" IS 'Original appointment date before rescheduling'`);

        await queryRunner.query(`ALTER TABLE "transactions" ADD "rescheduleCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions"."rescheduleCount" IS 'Number of times appointment was rescheduled'`);

        await queryRunner.query(`ALTER TABLE "transactions" ADD "lastRescheduledAt" TIMESTAMP`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions"."lastRescheduledAt" IS 'When appointment was last rescheduled'`);

        // Add indexes for the new fields
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transactions_appointment_date" ON "transactions" ("appointmentDate")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transactions_funds_status" ON "transactions" ("fundsStatus")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transactions_is_cancelled" ON "transactions" ("isCancelled")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transactions_refund_status" ON "transactions" ("refundStatus")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transactions_dispute_window_starts_at" ON "transactions" ("disputeWindowStartsAt")`);

        // Update existing completed appointment transactions with proper funds status
        // This is a data migration to set appropriate fundsStatus for existing records
        await queryRunner.query(`
            UPDATE "transactions" 
            SET "fundsStatus" = CASE 
                WHEN "serviceType" = 'appointment' AND "status" = 'completed' THEN 'pending_dispute'::transactions_fundsstatus_enum
                WHEN "status" = 'completed' THEN 'pending_dispute'::transactions_fundsstatus_enum
                ELSE 'pending_appointment'::transactions_fundsstatus_enum
            END
            WHERE "fundsStatus" = 'pending_appointment'::transactions_fundsstatus_enum
        `);

        // Set disputeWindowStartsAt for existing completed transactions
        await queryRunner.query(`
            UPDATE "transactions" 
            SET "disputeWindowStartsAt" = "completedAt"
            WHERE "status" = 'completed' AND "disputeWindowStartsAt" IS NULL
        `);
    }

    async down(queryRunner) {
        // Remove indexes
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_dispute_window_starts_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_refund_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_is_cancelled"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_funds_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_appointment_date"`);

        // Remove rescheduling fields
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "lastRescheduledAt"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "rescheduleCount"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "originalAppointmentDate"`);

        // Remove refund fields
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "refundProcessedAt"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "refundAmount"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "refundStatus"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_refundstatus_enum"`);

        // Remove cancellation fields
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "cancelledAt"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "isCancelled"`);

        // Remove fundsStatus field
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "fundsStatus"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_fundsstatus_enum"`);

        // Remove new timestamp fields
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "disputeWindowStartsAt"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "appointmentDate"`);

        // Revert disputeWindowEndsAt comment to original
        await queryRunner.query(`COMMENT ON COLUMN "transactions"."disputeWindowEndsAt" IS 'When 3-day dispute window ends'`);
    }
}