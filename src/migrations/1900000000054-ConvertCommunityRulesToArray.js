/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class ConvertCommunityRulesToArray1900000000054 {
    name = 'ConvertCommunityRulesToArray1900000000054'

    async up(queryRunner) {
        // Existing single-blob text rules become a one-item jsonb array; NULL stays NULL.
        await queryRunner.query(`
            ALTER TABLE "communities"
            ALTER COLUMN "rules" TYPE jsonb
            USING (CASE WHEN "rules" IS NULL THEN NULL ELSE jsonb_build_array("rules") END)
        `);
    }

    async down(queryRunner) {
        // Collapse the array back into a single newline-joined text blob.
        await queryRunner.query(`
            ALTER TABLE "communities"
            ALTER COLUMN "rules" TYPE text
            USING (CASE WHEN "rules" IS NULL THEN NULL ELSE (SELECT string_agg(value, E'\\n') FROM jsonb_array_elements_text("rules") AS value) END)
        `);
    }
}
