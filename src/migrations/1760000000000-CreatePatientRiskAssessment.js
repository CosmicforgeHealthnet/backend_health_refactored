const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class CreatePatientRiskAssessment1760000000000 {
    name = 'CreatePatientRiskAssessment1760000000000'

    async up(queryRunner) {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "patient_risk_assessments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "assessmentType" character varying NOT NULL,
                "riskScore" double precision NOT NULL,
                "riskLevel" character varying,
                "contributingFactors" jsonb,
                "aiModelVersion" character varying,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "patient_id" uuid,
                CONSTRAINT "PK_patient_risk_assessments_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "patient_risk_assessments" 
            ADD CONSTRAINT "FK_patient_risk_assessments_patient_id" 
            FOREIGN KEY ("patient_id") 
            REFERENCES "patient_profiles"("id") 
            ON DELETE CASCADE 
            ON UPDATE NO ACTION
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "patient_risk_assessments" DROP CONSTRAINT "FK_patient_risk_assessments_patient_id"`);
        await queryRunner.query(`DROP TABLE "patient_risk_assessments"`);
    }
}
