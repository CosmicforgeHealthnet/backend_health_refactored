const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class ConstraintBaseline1900000000004 {
  name = "ConstraintBaseline1900000000004";

  // Helper function to create the PG function
  async createHelperFunction(queryRunner) {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION add_fk_if_missing(
        tbl text, col text, ref_tbl text, ref_col text, const_name text
      ) RETURNS void AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = const_name AND table_name = tbl
        ) THEN
          EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE CASCADE', tbl, const_name, col, ref_tbl, ref_col);
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  async up(queryRunner) {
    // 1. Setup Helper Function
    await this.createHelperFunction(queryRunner);

    // 2. DATA CLEANUP (Exhaustive cleanup of orphans that block FKs)
    await queryRunner.query(`
      -- A. Delete CHILD records first (to avoid dependency violations)
      
      -- Remove messages belonging to orphan sessions OR having orphans itself
      DELETE FROM "chatbot_messages" WHERE "userId" NOT IN (SELECT "id" FROM "users") 
         OR "sessionId" NOT IN (SELECT "id" FROM "chatbot_sessions")
         OR "sessionId" IN (SELECT "id" FROM "chatbot_sessions" WHERE "userId" NOT IN (SELECT "id" FROM "users"));

      -- B. Delete PARENT records
      
      -- Remove profiles pointing to missing users
      DELETE FROM "doctor_profiles" WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT "id" FROM "users");
      DELETE FROM "patient_profiles" WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT "id" FROM "users");
      DELETE FROM "pharmacy_profiles" WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT "id" FROM "users");

      -- Remove feature orphans pointing to missing users
      DELETE FROM "appointments" WHERE "patientId" NOT IN (SELECT "id" FROM "users") OR "doctorId" NOT IN (SELECT "id" FROM "users");
      DELETE FROM "prescriptions" WHERE "patientId" NOT IN (SELECT "id" FROM "users") OR "doctorId" NOT IN (SELECT "id" FROM "users");
      DELETE FROM "chatbot_sessions" WHERE "userId" NOT IN (SELECT "id" FROM "users");
      DELETE FROM "user_referrals" WHERE "referrerId" NOT IN (SELECT "id" FROM "users");
      DELETE FROM "referral_draws" WHERE "createdBy" NOT IN (SELECT "id" FROM "users");
      DELETE FROM "user_ratings" WHERE "userId" NOT IN (SELECT "id" FROM "users");
    `);

    // 3. FIX NOTIFICATION FK BUG
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_notification_userId' AND table_name = 'notification') THEN
          ALTER TABLE "notification" DROP CONSTRAINT "FK_notification_userId";
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_notifications_users' AND table_name = 'notification') THEN
          ALTER TABLE "notification" ADD CONSTRAINT "FK_notifications_users" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    // 4. ADD ALL OTHER FOREIGN KEYS IDEMPOTENTLY
    await queryRunner.query(`
      DO $$
      BEGIN
        -- Core Profile Relations
        PERFORM add_fk_if_missing('doctor_profiles', 'userId', 'users', 'id', 'FK_doctor_profiles_users');
        PERFORM add_fk_if_missing('patient_profiles', 'userId', 'users', 'id', 'FK_patient_profiles_users');
        PERFORM add_fk_if_missing('professional_licenses', 'doctorProfileId', 'doctor_profiles', 'id', 'FK_professional_licenses_doctor');
        PERFORM add_fk_if_missing('professional_certificates', 'doctorProfileId', 'doctor_profiles', 'id', 'FK_professional_certificates_doctor');
        PERFORM add_fk_if_missing('clinical_practices', 'doctorProfileId', 'doctor_profiles', 'id', 'FK_clinical_practices_doctor');
        PERFORM add_fk_if_missing('digital_health_tools', 'doctorProfileId', 'doctor_profiles', 'id', 'FK_digital_health_tools_doctor');

        -- Appointment Relations
        PERFORM add_fk_if_missing('appointments', 'patientId', 'users', 'id', 'FK_appointments_patient');
        PERFORM add_fk_if_missing('appointments', 'doctorId', 'users', 'id', 'FK_appointments_doctor');

        -- Pharmacy & Prescription Relations
        PERFORM add_fk_if_missing('pharmacy_profiles', 'userId', 'users', 'id', 'FK_pharmacy_profiles_users');
        PERFORM add_fk_if_missing('pharmacy_branches', 'pharmacyId', 'pharmacy_profiles', 'id', 'FK_pharmacy_branches_pharmacy');
        PERFORM add_fk_if_missing('pharmacy_verification_requests', 'pharmacyId', 'pharmacy_profiles', 'id', 'FK_pharmacy_verification_requests_pharmacy');
        PERFORM add_fk_if_missing('prescriptions', 'doctorId', 'users', 'id', 'FK_prescriptions_doctor');
        PERFORM add_fk_if_missing('prescriptions', 'patientId', 'users', 'id', 'FK_prescriptions_patient');
        PERFORM add_fk_if_missing('prescriptions', 'pharmacyId', 'pharmacy_profiles', 'id', 'FK_prescriptions_pharmacy');

        -- Chatbot Relations
        PERFORM add_fk_if_missing('chatbot_sessions', 'userId', 'users', 'id', 'FK_chatbot_sessions_users');
        PERFORM add_fk_if_missing('chatbot_messages', 'sessionId', 'chatbot_sessions', 'id', 'FK_chatbot_messages_session');
        PERFORM add_fk_if_missing('chatbot_messages', 'userId', 'users', 'id', 'FK_chatbot_messages_user');

        -- Shared Feature Relations
        PERFORM add_fk_if_missing('user_referrals', 'referrerId', 'users', 'id', 'FK_user_referrals_referrer');
        PERFORM add_fk_if_missing('user_referrals', 'drawId', 'referral_draws', 'id', 'FK_user_referrals_draw');
        PERFORM add_fk_if_missing('referral_draws', 'createdBy', 'users', 'id', 'FK_referral_draws_users');
        PERFORM add_fk_if_missing('user_ratings', 'userId', 'users', 'id', 'FK_user_ratings_users');
      END $$;
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT IF EXISTS "FK_notifications_users"`);
  }
};
