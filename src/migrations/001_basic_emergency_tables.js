/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 * @typedef {import('typeorm').QueryRunner} QueryRunner
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class CreateEmergencyModule1757301090000 {
    name = 'CreateEmergencyModule1757301090000'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        // Hospitals
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "hospitals" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" VARCHAR NOT NULL,
                "address" TEXT,
                "phone" VARCHAR,
                "email" VARCHAR,
                "latitude" DOUBLE PRECISION,
                "longitude" DOUBLE PRECISION,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_hospitals_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_HOSPITAL_NAME" ON "hospitals" ("name")`);

        // Emergency Contacts
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "emergency_contacts" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" VARCHAR NOT NULL,
                "phone" VARCHAR NOT NULL,
                "relation" VARCHAR,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_emergency_contacts_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_CONTACT_PHONE" ON "emergency_contacts" ("phone")`);

        // SOS Events
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "sos_events" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "location" VARCHAR,
                "status" VARCHAR NOT NULL DEFAULT 'pending',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_sos_events_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_SOS_USER" ON "sos_events" ("user_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_SOS_STATUS" ON "sos_events" ("status")`);

        // Foreign key for sos_events → users
        await queryRunner.query(`
            ALTER TABLE "sos_events"
            ADD CONSTRAINT "FK_sos_events_user"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "sos_events" DROP CONSTRAINT "FK_sos_events_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_SOS_STATUS"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_SOS_USER"`);
        await queryRunner.query(`DROP TABLE "sos_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CONTACT_PHONE"`);
        await queryRunner.query(`DROP TABLE "emergency_contacts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_HOSPITAL_NAME"`);
        await queryRunner.query(`DROP TABLE "hospitals"`);
    }
}
