module.exports = class MultiRoleEmailSupport1900000000048 {
  name = 'MultiRoleEmailSupport1900000000048';

  async up(queryRunner) {
    // Drop the old single-column unique constraint on email
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_97672ac88f789774dd47f7c8be3"`);

    // Add composite unique: same email can exist with different roles
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_email_role_unique" UNIQUE ("email", "role")`
    );
  }

  async down(queryRunner) {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_role_unique"`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email")`);
  }
};
