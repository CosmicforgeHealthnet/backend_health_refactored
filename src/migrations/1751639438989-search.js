/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class Search1751639438989 {
    name = 'Search1751639438989'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."search_logs_userrole_enum" AS ENUM('patient', 'doctor', 'pharmacy', 'lab', 'admin', 'super_admin')`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "search_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "query" character varying(255) NOT NULL, "userRole" "public"."search_logs_userrole_enum" NOT NULL, "resultsCount" integer NOT NULL DEFAULT '0', "searchTime" integer, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "sessionFingerprint" character varying(64), CONSTRAINT "PK_a7de6b052b1a608961dc46e843d" PRIMARY KEY ("id")); COMMENT ON COLUMN "search_logs"."query" IS 'The search query (anonymized and lowercased)'; COMMENT ON COLUMN "search_logs"."userRole" IS 'Role of the user who performed the search'; COMMENT ON COLUMN "search_logs"."resultsCount" IS 'Number of results returned'; COMMENT ON COLUMN "search_logs"."searchTime" IS 'Search execution time in milliseconds'; COMMENT ON COLUMN "search_logs"."timestamp" IS 'When the search was performed'; COMMENT ON COLUMN "search_logs"."sessionFingerprint" IS 'Anonymous session identifier for analytics'`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b9ed845f64d320e335caee62d3" ON "search_logs" ("query") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_8185b39c539ce71478d7604bbd" ON "search_logs" ("userRole") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_bac4164acefd9d64d941eae63a" ON "search_logs" ("timestamp") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_a9792fc773a92f36302cb532fe" ON "search_logs" ("query", "userRole") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."IDX_a9792fc773a92f36302cb532fe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bac4164acefd9d64d941eae63a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8185b39c539ce71478d7604bbd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b9ed845f64d320e335caee62d3"`);
        await queryRunner.query(`DROP TABLE "search_logs"`);
        await queryRunner.query(`DROP TYPE "public"."search_logs_userrole_enum"`);
    }
}
