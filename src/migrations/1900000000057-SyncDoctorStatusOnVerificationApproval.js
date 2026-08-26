/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * Keeps users.status in sync with verification_requests.status at the
 * database level, via a trigger — not application code.
 *
 * Why: a separate, centralized admin application (a different codebase)
 * writes directly to this same Postgres database to approve doctors. It
 * updates verification_requests (status, approvedAt, reviewCompletedAt,
 * assignedReviewerId) but has no knowledge of this backend's users.status
 * field, so users.status was silently left at 'pending_doctor_verification'
 * even though the verification was genuinely approved — the doctor would
 * then be wrongly denied wallet access ("Doctor account must be verified").
 *
 * This backend's own doctorVerificationService.approveVerification() already
 * keeps the two in sync via an application-level transaction, but that only
 * covers writes that go through this app. A DB trigger is the one place
 * both codebases actually meet, so it's the only fix that closes the gap
 * regardless of which application performs the write.
 *
 * Rejection intentionally does NOT touch users.status here, mirroring
 * doctorVerificationService.rejectVerification()'s existing rule (a
 * rejected doctor keeps their current status and can resubmit).
 *
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class SyncDoctorStatusOnVerificationApproval1900000000057 {
    name = 'SyncDoctorStatusOnVerificationApproval1900000000057'

    async up(queryRunner) {
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION sync_doctor_status_on_verification_approval()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.status = 'approved'
                   AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
                    UPDATE "users" SET "status" = 'doctor_active' WHERE "id" = NEW."doctorId";
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        await queryRunner.query(`
            DROP TRIGGER IF EXISTS trg_sync_doctor_status_on_verification_approval ON "verification_requests";
        `);

        await queryRunner.query(`
            CREATE TRIGGER trg_sync_doctor_status_on_verification_approval
            AFTER INSERT OR UPDATE OF status ON "verification_requests"
            FOR EACH ROW
            EXECUTE FUNCTION sync_doctor_status_on_verification_approval();
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS trg_sync_doctor_status_on_verification_approval ON "verification_requests";
        `);
        await queryRunner.query(`
            DROP FUNCTION IF EXISTS sync_doctor_status_on_verification_approval();
        `);
    }
}
