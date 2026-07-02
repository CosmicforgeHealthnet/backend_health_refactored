module.exports = class AddCartPrescriptionLink1900000000047 {
  name = 'AddCartPrescriptionLink1900000000047';

  async up(queryRunner) {
    // Add 'paid' to the carts status enum
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "carts_status_enum" ADD VALUE IF NOT EXISTS 'paid';
      EXCEPTION WHEN others THEN null; END $$
    `);

    // Add prescriptionId column so patient can link a prescription at checkout
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD COLUMN IF NOT EXISTS "prescriptionId" UUID NULL,
        ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP NULL
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "carts"
        DROP COLUMN IF EXISTS "prescriptionId",
        DROP COLUMN IF EXISTS "paidAt"
    `);
    // Enum value removal not supported in Postgres — leave enum as-is on rollback
  }
};
