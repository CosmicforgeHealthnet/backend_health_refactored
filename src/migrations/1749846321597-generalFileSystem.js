/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class GeneralFileSystem1749846321597 {
    name = 'GeneralFileSystem1749846321597'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."document_folders_folder_type_enum" AS ENUM('verification', 'medical_records', 'prescription', 'lab_results', 'profile', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."document_folders_status_enum" AS ENUM('active', 'archived', 'deleted')`);
        await queryRunner.query(`CREATE TABLE "document_folders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "folder_type" "public"."document_folders_folder_type_enum" NOT NULL DEFAULT 'other', "status" "public"."document_folders_status_enum" NOT NULL DEFAULT 'active', "owner_id" uuid NOT NULL, "encryption_key" character varying, "folder_hash" character varying, "metadata" jsonb, "tags" text, "is_public" boolean NOT NULL DEFAULT false, "expires_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0307e252e6c13b4ff3ade731523" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_FOLDER_OWNER" ON "document_folders" ("owner_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_FOLDER_TYPE_STATUS" ON "document_folders" ("folder_type", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_FOLDER_CREATED" ON "document_folders" ("created_at") `);
        await queryRunner.query(`CREATE TYPE "public"."document_files_status_enum" AS ENUM('uploaded', 'processing', 'ready', 'corrupted', 'deleted')`);
        await queryRunner.query(`CREATE TYPE "public"."document_files_security_level_enum" AS ENUM('public', 'private', 'confidential', 'restricted')`);
        await queryRunner.query(`CREATE TABLE "document_files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "original_file_name" character varying NOT NULL, "stored_file_name" character varying NOT NULL, "file_path" character varying NOT NULL, "file_size" bigint NOT NULL, "mime_type" character varying NOT NULL, "file_hash" character varying NOT NULL, "encryption_key" character varying, "document_type" character varying NOT NULL, "status" "public"."document_files_status_enum" NOT NULL DEFAULT 'uploaded', "security_level" "public"."document_files_security_level_enum" NOT NULL DEFAULT 'private', "folder_id" uuid NOT NULL, "uploader_id" uuid NOT NULL, "download_count" integer NOT NULL DEFAULT '0', "last_accessed_at" TIMESTAMP, "metadata" jsonb, "thumbnail_path" character varying, "is_encrypted" boolean NOT NULL DEFAULT false, "checksum" character varying, "version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_15e5583cf50fcf0066e2cb57227" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_FILE_FOLDER" ON "document_files" ("folder_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_FILE_UPLOADER" ON "document_files" ("uploader_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_FILE_HASH" ON "document_files" ("file_hash") `);
        await queryRunner.query(`CREATE INDEX "IDX_FILE_TYPE_STATUS" ON "document_files" ("document_type", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_FILE_CREATED" ON "document_files" ("created_at") `);
        await queryRunner.query(`CREATE TYPE "public"."folder_access_logs_access_type_enum" AS ENUM('view', 'download', 'upload', 'delete', 'share', 'modify')`);
        await queryRunner.query(`CREATE TABLE "folder_access_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "access_type" "public"."folder_access_logs_access_type_enum" NOT NULL, "folder_id" uuid NOT NULL, "user_id" uuid NOT NULL, "ip_address" character varying, "user_agent" text, "accessed_at" TIMESTAMP NOT NULL DEFAULT now(), "metadata" jsonb, CONSTRAINT "PK_af9238baf523ad0c0a3ddad881c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_FOLDER_ACCESS_FOLDER" ON "folder_access_logs" ("folder_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_FOLDER_ACCESS_USER" ON "folder_access_logs" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_FOLDER_ACCESS_TIME" ON "folder_access_logs" ("accessed_at") `);
        await queryRunner.query(`CREATE TYPE "public"."file_access_logs_access_type_enum" AS ENUM('view', 'download', 'upload', 'delete', 'share', 'modify')`);
        await queryRunner.query(`CREATE TABLE "file_access_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "access_type" "public"."file_access_logs_access_type_enum" NOT NULL, "file_id" uuid NOT NULL, "user_id" uuid NOT NULL, "ip_address" character varying, "user_agent" text, "download_duration" integer, "accessed_at" TIMESTAMP NOT NULL DEFAULT now(), "metadata" jsonb, CONSTRAINT "PK_be1d3092396a30ffa25b0e9c7e8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_FILE_ACCESS_FILE" ON "file_access_logs" ("file_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_FILE_ACCESS_USER" ON "file_access_logs" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_FILE_ACCESS_TIME" ON "file_access_logs" ("accessed_at") `);
        await queryRunner.query(`ALTER TABLE "document_folders" ADD CONSTRAINT "FK_bbd7d96367e620e29d0adf195fe" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_files" ADD CONSTRAINT "FK_eacf52f1c3e0203694e0b485acb" FOREIGN KEY ("folder_id") REFERENCES "document_folders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_files" ADD CONSTRAINT "FK_a1c1b6510fa137a01b3d84905aa" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "folder_access_logs" ADD CONSTRAINT "FK_123597b8b39d3311fb919e04004" FOREIGN KEY ("folder_id") REFERENCES "document_folders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "folder_access_logs" ADD CONSTRAINT "FK_f6106de9a12e5a5c548317825cc" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "file_access_logs" ADD CONSTRAINT "FK_f1101a0737439a005eb075a8f2d" FOREIGN KEY ("file_id") REFERENCES "document_files"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "file_access_logs" ADD CONSTRAINT "FK_fe32f075b4210b25158b5be1e3e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "file_access_logs" DROP CONSTRAINT "FK_fe32f075b4210b25158b5be1e3e"`);
        await queryRunner.query(`ALTER TABLE "file_access_logs" DROP CONSTRAINT "FK_f1101a0737439a005eb075a8f2d"`);
        await queryRunner.query(`ALTER TABLE "folder_access_logs" DROP CONSTRAINT "FK_f6106de9a12e5a5c548317825cc"`);
        await queryRunner.query(`ALTER TABLE "folder_access_logs" DROP CONSTRAINT "FK_123597b8b39d3311fb919e04004"`);
        await queryRunner.query(`ALTER TABLE "document_files" DROP CONSTRAINT "FK_a1c1b6510fa137a01b3d84905aa"`);
        await queryRunner.query(`ALTER TABLE "document_files" DROP CONSTRAINT "FK_eacf52f1c3e0203694e0b485acb"`);
        await queryRunner.query(`ALTER TABLE "document_folders" DROP CONSTRAINT "FK_bbd7d96367e620e29d0adf195fe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FILE_ACCESS_TIME"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FILE_ACCESS_USER"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FILE_ACCESS_FILE"`);
        await queryRunner.query(`DROP TABLE "file_access_logs"`);
        await queryRunner.query(`DROP TYPE "public"."file_access_logs_access_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FOLDER_ACCESS_TIME"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FOLDER_ACCESS_USER"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FOLDER_ACCESS_FOLDER"`);
        await queryRunner.query(`DROP TABLE "folder_access_logs"`);
        await queryRunner.query(`DROP TYPE "public"."folder_access_logs_access_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FILE_CREATED"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FILE_TYPE_STATUS"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FILE_HASH"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FILE_UPLOADER"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FILE_FOLDER"`);
        await queryRunner.query(`DROP TABLE "document_files"`);
        await queryRunner.query(`DROP TYPE "public"."document_files_security_level_enum"`);
        await queryRunner.query(`DROP TYPE "public"."document_files_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FOLDER_CREATED"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FOLDER_TYPE_STATUS"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_FOLDER_OWNER"`);
        await queryRunner.query(`DROP TABLE "document_folders"`);
        await queryRunner.query(`DROP TYPE "public"."document_folders_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."document_folders_folder_type_enum"`);
    }
}
