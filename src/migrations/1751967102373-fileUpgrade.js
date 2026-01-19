/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class FileUpgrade1751967102373 {
    name = 'FileUpgrade1751967102373'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."document_files_fhir_resource_type_enum" AS ENUM('Patient', 'Practitioner', 'Organization', 'Observation', 'DiagnosticReport', 'Condition', 'Procedure', 'MedicationRequest', 'MedicationStatement', 'AllergyIntolerance', 'Immunization', 'CarePlan', 'Encounter', 'DocumentReference', 'Consent', 'Other')`);
        await queryRunner.query(`ALTER TABLE "document_files" ADD "fhir_resource_type" "public"."document_files_fhir_resource_type_enum"`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."fhir_resource_type" IS 'FHIR resource type if document contains FHIR data'`);
        await queryRunner.query(`ALTER TABLE "document_files" ADD "patient_identifier" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."patient_identifier" IS 'Patient ID extracted from FHIR resource for linking related documents'`);
        await queryRunner.query(`ALTER TABLE "document_files" ADD "fhir_security_labels" jsonb`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."fhir_security_labels" IS 'FHIR security labels from meta.security field'`);
        await queryRunner.query(`ALTER TABLE "document_files" ADD "consent_directives" jsonb`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."consent_directives" IS 'Patient consent directives and restrictions'`);
        await queryRunner.query(`ALTER TABLE "document_files" ADD "fhir_version" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."fhir_version" IS 'FHIR specification version (e.g., 4.0.1)'`);
        await queryRunner.query(`CREATE TYPE "public"."document_files_fhir_sensitivity_level_enum" AS ENUM('normal', 'high', 'very_high')`);
        await queryRunner.query(`ALTER TABLE "document_files" ADD "fhir_sensitivity_level" "public"."document_files_fhir_sensitivity_level_enum" DEFAULT 'normal'`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."fhir_sensitivity_level" IS 'FHIR-specific sensitivity classification'`);
        await queryRunner.query(`ALTER TABLE "document_files" ADD "fhir_resource_id" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."fhir_resource_id" IS 'Original FHIR resource ID'`);
        await queryRunner.query(`ALTER TABLE "document_files" ADD "purpose_of_use" jsonb`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."purpose_of_use" IS 'Intended purpose of use for access control'`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."metadata" IS 'Extended metadata including FHIR-specific information'`);
        await queryRunner.query(`CREATE INDEX "IDX_FHIR_RESOURCE_TYPE" ON "document_files" ("fhir_resource_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_PATIENT_IDENTIFIER" ON "document_files" ("patient_identifier") `);
        await queryRunner.query(`CREATE INDEX "IDX_FHIR_SENSITIVITY" ON "document_files" ("fhir_sensitivity_level") `);
        await queryRunner.query(`CREATE INDEX "IDX_PATIENT_RESOURCE" ON "document_files" ("patient_identifier", "fhir_resource_type") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."IDX_PATIENT_RESOURCE"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FHIR_SENSITIVITY"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_PATIENT_IDENTIFIER"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FHIR_RESOURCE_TYPE"`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."metadata" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."purpose_of_use" IS 'Intended purpose of use for access control'`);
        await queryRunner.query(`ALTER TABLE "document_files" DROP COLUMN "purpose_of_use"`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."fhir_resource_id" IS 'Original FHIR resource ID'`);
        await queryRunner.query(`ALTER TABLE "document_files" DROP COLUMN "fhir_resource_id"`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."fhir_sensitivity_level" IS 'FHIR-specific sensitivity classification'`);
        await queryRunner.query(`ALTER TABLE "document_files" DROP COLUMN "fhir_sensitivity_level"`);
        await queryRunner.query(`DROP TYPE "public"."document_files_fhir_sensitivity_level_enum"`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."fhir_version" IS 'FHIR specification version (e.g., 4.0.1)'`);
        await queryRunner.query(`ALTER TABLE "document_files" DROP COLUMN "fhir_version"`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."consent_directives" IS 'Patient consent directives and restrictions'`);
        await queryRunner.query(`ALTER TABLE "document_files" DROP COLUMN "consent_directives"`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."fhir_security_labels" IS 'FHIR security labels from meta.security field'`);
        await queryRunner.query(`ALTER TABLE "document_files" DROP COLUMN "fhir_security_labels"`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."patient_identifier" IS 'Patient ID extracted from FHIR resource for linking related documents'`);
        await queryRunner.query(`ALTER TABLE "document_files" DROP COLUMN "patient_identifier"`);
        await queryRunner.query(`COMMENT ON COLUMN "document_files"."fhir_resource_type" IS 'FHIR resource type if document contains FHIR data'`);
        await queryRunner.query(`ALTER TABLE "document_files" DROP COLUMN "fhir_resource_type"`);
        await queryRunner.query(`DROP TYPE "public"."document_files_fhir_resource_type_enum"`);
    }
}
