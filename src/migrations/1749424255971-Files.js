/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class Files1749424255971 {
    name = 'Files1749424255971'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "upload_by" uuid NOT NULL, "file_url" character varying(1024) NOT NULL, "file_name" character varying(255) NOT NULL, "folder_name" character varying(255) NOT NULL, "file_id" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id")); COMMENT ON COLUMN "files"."file_id" IS 'Cloud provider file identifier'`);
        await queryRunner.query(`ALTER TABLE "files" ADD CONSTRAINT "FK_33faa730104a595796f42120a2a" FOREIGN KEY ("upload_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "files" DROP CONSTRAINT "FK_33faa730104a595796f42120a2a"`);
        await queryRunner.query(`DROP TABLE "files"`);
    }
}
