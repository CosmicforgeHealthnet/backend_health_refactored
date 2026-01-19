/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class PatientLodSIght1757675572478 {
    name = 'PatientLodSIght1757675572478'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TYPE "public"."patient_access_logs_access_type_enum" RENAME TO "patient_access_logs_access_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."patient_access_logs_access_type_enum" AS ENUM('view', 'download', 'search', 'create', 'update', 'delete', 'view_patient_summary', 'view_patient_files', 'emergency_access')`);
        await queryRunner.query(`ALTER TABLE "patient_access_logs" ALTER COLUMN "access_type" TYPE "public"."patient_access_logs_access_type_enum" USING "access_type"::"text"::"public"."patient_access_logs_access_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."patient_access_logs_access_type_enum_old"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."patient_access_logs_access_type_enum_old" AS ENUM('create', 'delete', 'download', 'search', 'update', 'view')`);
        await queryRunner.query(`ALTER TABLE "patient_access_logs" ALTER COLUMN "access_type" TYPE "public"."patient_access_logs_access_type_enum_old" USING "access_type"::"text"::"public"."patient_access_logs_access_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."patient_access_logs_access_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."patient_access_logs_access_type_enum_old" RENAME TO "patient_access_logs_access_type_enum"`);
    }
}
