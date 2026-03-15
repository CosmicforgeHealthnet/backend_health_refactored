/**
 * Migration: AddPharmacyStaffRoles
 *
 * Adds pharmacy staff role values to users_role_enum:
 *   pharmacist, assistant, dispatcher
 *
 * These are the roles used when a pharmacy owner adds staff members.
 */
module.exports = class AddPharmacyStaffRoles1761200000000 {
  name = "AddPharmacyStaffRoles1761200000000";

  async up(queryRunner) {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'pharmacist';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'assistant';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'dispatcher';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  async down(queryRunner) {
    // PostgreSQL does not support DROP VALUE from an enum — no-op
  }
};
