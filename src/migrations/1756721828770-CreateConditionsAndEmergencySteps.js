/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class CreateConditionsAndEmergencySteps1756721828770 {
    name = 'CreateConditionsAndEmergencySteps1756721828770'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "conditions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "content_type" "public"."conditions_content_type_enum" NOT NULL, "image_file_id" uuid, "severity" "public"."conditions_severity_enum" NOT NULL DEFAULT 'medium', "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_5e8dc92cd9007244d1daded3fc" UNIQUE ("image_file_id"), CONSTRAINT "PK_3938bdf2933c08ac7af7e0e15e7" PRIMARY KEY ("id")); COMMENT ON COLUMN "conditions"."image_file_id" IS 'Primary condition image - one image per condition'; COMMENT ON COLUMN "conditions"."metadata" IS 'Additional condition metadata'`);
        await queryRunner.query(`CREATE INDEX "IDX_CONDITION_CONTENT_TYPE" ON "conditions" ("content_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_CONDITION_IMAGE" ON "conditions" ("image_file_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_CONDITION_SEVERITY" ON "conditions" ("severity") `);
        await queryRunner.query(`CREATE INDEX "IDX_CONDITION_ACTIVE" ON "conditions" ("is_active") `);
        await queryRunner.query(`ALTER TABLE "conditions" ADD CONSTRAINT "FK_5e8dc92cd9007244d1daded3fc7" FOREIGN KEY ("image_file_id") REFERENCES "document_files"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "emergency_steps" ADD CONSTRAINT "FK_cac417063874fcf06a3f54b2dd5" FOREIGN KEY ("condition_id") REFERENCES "conditions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "emergency_steps" DROP CONSTRAINT "FK_cac417063874fcf06a3f54b2dd5"`);
        await queryRunner.query(`ALTER TABLE "conditions" DROP CONSTRAINT "FK_5e8dc92cd9007244d1daded3fc7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CONDITION_ACTIVE"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CONDITION_SEVERITY"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CONDITION_IMAGE"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CONDITION_CONTENT_TYPE"`);
        await queryRunner.query(`DROP TABLE "conditions"`);
    }
}
