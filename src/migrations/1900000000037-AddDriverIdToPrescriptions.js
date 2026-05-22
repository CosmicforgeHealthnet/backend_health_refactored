module.exports = class AddDriverIdToPrescriptions1900000000037 {
    name = 'AddDriverIdToPrescriptions1900000000037';

    async up(queryRunner) {
        await queryRunner.query(`
            ALTER TABLE "prescriptions"
                ADD COLUMN IF NOT EXISTS "driverId" uuid DEFAULT NULL,
                ADD CONSTRAINT "FK_prescriptions_driverId"
                    FOREIGN KEY ("driverId") REFERENCES "users"("id")
                    ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_prescriptions_driverId"
                ON "prescriptions" ("driverId")
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prescriptions_driverId"`);
        await queryRunner.query(`
            ALTER TABLE "prescriptions"
                DROP CONSTRAINT IF EXISTS "FK_prescriptions_driverId",
                DROP COLUMN IF EXISTS "driverId"
        `);
    }
};
