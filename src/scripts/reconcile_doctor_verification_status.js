/**
 * DOCTOR VERIFICATION STATUS RECONCILIATION
 *
 * Compares each doctor's `users.status` against the outcome of their most
 * recent `verification_requests` row and reports (or fixes) mismatches.
 *
 * Background: an earlier repair script (repair_users.js) force-set
 * users.status = 'doctor_active' for every user with a doctor_profiles row,
 * regardless of whether they were ever actually approved. This script finds
 * doctors where users.status disagrees with the real verification outcome.
 *
 * Rule (matches doctorVerificationService.approveVerification/rejectVerification):
 *   - latest verification_requests.status === 'approved' -> users.status should be 'doctor_active'
 *   - anything else (pending/in_progress/manual_review/rejected/expired/no request) -> 'pending_doctor_verification'
 *   - accounts with users.status === 'locked' are skipped (unrelated security state)
 *   - accounts with users.status === 'pending_email_verification' are skipped (haven't reached doctor verification yet)
 *
 * Usage:
 *   node src/scripts/reconcile_doctor_verification_status.js            # dry run, report only
 *   node src/scripts/reconcile_doctor_verification_status.js --apply    # apply the fixes
 */
const AppDataSource = require("../config/database");

const APPLY = process.argv.includes("--apply");

function correctStatusFor(latestRequestStatus) {
  if (latestRequestStatus === "approved") return "doctor_active";
  return "pending_doctor_verification";
}

async function run() {
  console.log(`🚀 Doctor verification status reconciliation (${APPLY ? "APPLY" : "DRY RUN"})`);

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  console.log(`✅ Database connected: ${AppDataSource.options.database}@${AppDataSource.options.host}`);

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    const doctors = await queryRunner.query(`
      SELECT id, email, "fullName", status
      FROM "users"
      WHERE role = 'doctor'
        AND status NOT IN ('locked', 'pending_email_verification')
      ORDER BY "createdAt" ASC;
    `);

    console.log(`👤 Found ${doctors.length} doctor accounts to check.\n`);

    const mismatches = [];

    for (const doctor of doctors) {
      const [latestRequest] = await queryRunner.query(
        `
        SELECT status, "createdAt"
        FROM "verification_requests"
        WHERE "doctorId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 1;
      `,
        [doctor.id]
      );

      const latestRequestStatus = latestRequest ? latestRequest.status : null;
      const expectedStatus = correctStatusFor(latestRequestStatus);

      if (doctor.status !== expectedStatus) {
        mismatches.push({
          id: doctor.id,
          email: doctor.email,
          fullName: doctor.fullName,
          currentStatus: doctor.status,
          latestRequestStatus,
          expectedStatus,
        });
      }
    }

    if (mismatches.length === 0) {
      console.log("✅ No mismatches found. users.status is consistent with verification_requests for all doctors.");
    } else {
      console.log(`⚠️ Found ${mismatches.length} mismatched doctor(s):\n`);
      for (const m of mismatches) {
        console.log(
          `- ${m.fullName} <${m.email}> (${m.id})\n` +
            `    users.status        = ${m.currentStatus}\n` +
            `    latest request      = ${m.latestRequestStatus ?? "(no verification request found)"}\n` +
            `    should be           = ${m.expectedStatus}\n`
        );
      }

      if (APPLY) {
        console.log("🔄 Applying fixes...");
        for (const m of mismatches) {
          await queryRunner.query(`UPDATE "users" SET status = $1 WHERE id = $2;`, [m.expectedStatus, m.id]);
        }
        console.log(`✅ Updated ${mismatches.length} doctor(s).`);
      } else {
        console.log("ℹ️ Dry run only — no changes made. Re-run with --apply to fix these records.");
      }
    }
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Reconciliation failed:", error);
    process.exit(1);
  });
