/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class ResourceAccessLogStuff1757676148716 {
    name = 'ResourceAccessLogStuff1757676148716'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "resource_access_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "resource_type" character varying NOT NULL, "user_id" uuid NOT NULL, "access_type" "public"."resource_access_logs_access_type_enum" NOT NULL, "ip_address" character varying, "user_agent" text, "accessed_at" TIMESTAMP NOT NULL DEFAULT now(), "metadata" jsonb, CONSTRAINT "PK_0e93e87ae741c29a75c15a5bf00" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_RESOURCE_ACCESS_TYPE" ON "resource_access_logs" ("resource_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_RESOURCE_ACCESS_USER" ON "resource_access_logs" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_RESOURCE_ACCESS_TIME" ON "resource_access_logs" ("accessed_at") `);
        await queryRunner.query(`ALTER TABLE "resource_access_logs" ADD CONSTRAINT "FK_d2989be0e9dea03e7bbf993a9cf" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "resource_access_logs" DROP CONSTRAINT "FK_d2989be0e9dea03e7bbf993a9cf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_RESOURCE_ACCESS_TIME"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_RESOURCE_ACCESS_USER"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_RESOURCE_ACCESS_TYPE"`);
        await queryRunner.query(`DROP TABLE "resource_access_logs"`);
    }
}
