/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AuditOnHistory1757678527028 {
    name = 'AuditOnHistory1757678527028'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TYPE "public"."comprehensive_audit_logs_event_type_enum" RENAME TO "comprehensive_audit_logs_event_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."comprehensive_audit_logs_event_type_enum" AS ENUM('file_upload', 'file_download', 'file_view', 'file_delete', 'file_modify', 'fhir_resource_access', 'patient_data_access', 'fhir_search', 'consent_granted', 'consent_withdrawn', 'consent_modified', 'consent_checked', 'login_success', 'login_failure', 'logout', 'permission_denied', 'emergency_access', 'key_rotation', 'key_generation', 'encryption_event', 'decryption_event', 'compliance_report', 'data_export', 'data_retention', 'anonymization', 'consent_history_access')`);
        await queryRunner.query(`ALTER TABLE "comprehensive_audit_logs" ALTER COLUMN "event_type" TYPE "public"."comprehensive_audit_logs_event_type_enum" USING "event_type"::"text"::"public"."comprehensive_audit_logs_event_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."comprehensive_audit_logs_event_type_enum_old"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."comprehensive_audit_logs_event_type_enum_old" AS ENUM('file_upload', 'file_download', 'file_view', 'file_delete', 'file_modify', 'fhir_resource_access', 'patient_data_access', 'fhir_search', 'consent_granted', 'consent_withdrawn', 'consent_modified', 'consent_checked', 'login_success', 'login_failure', 'logout', 'permission_denied', 'emergency_access', 'key_rotation', 'key_generation', 'encryption_event', 'decryption_event', 'compliance_report', 'data_export', 'data_retention', 'anonymization')`);
        await queryRunner.query(`ALTER TABLE "comprehensive_audit_logs" ALTER COLUMN "event_type" TYPE "public"."comprehensive_audit_logs_event_type_enum_old" USING "event_type"::"text"::"public"."comprehensive_audit_logs_event_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."comprehensive_audit_logs_event_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."comprehensive_audit_logs_event_type_enum_old" RENAME TO "comprehensive_audit_logs_event_type_enum"`);
    }
}
