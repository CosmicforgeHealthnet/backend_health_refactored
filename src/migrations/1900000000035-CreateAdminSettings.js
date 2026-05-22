module.exports = class CreateAdminSettings1900000000035 {
    name = 'CreateAdminSettings1900000000035';

    async up(queryRunner) {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_settings" (
                "id"          uuid          NOT NULL DEFAULT uuid_generate_v4(),
                "category"    varchar(100)  NOT NULL,
                "key"         varchar(200)  NOT NULL,
                "value"       json          NOT NULL,
                "updatedBy"   uuid,
                "createdAt"   TIMESTAMP(6)  NOT NULL DEFAULT now(),
                "updatedAt"   TIMESTAMP(6)  NOT NULL DEFAULT now(),
                CONSTRAINT "PK_admin_settings" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_admin_settings_category_key" UNIQUE ("category", "key"),
                CONSTRAINT "FK_admin_settings_updatedBy"
                    FOREIGN KEY ("updatedBy") REFERENCES "users"("id")
                    ON UPDATE NO ACTION ON DELETE SET NULL
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_admin_settings_category"   ON "admin_settings" ("category")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_admin_settings_updatedBy"  ON "admin_settings" ("updatedBy")`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_settings_history" (
                "id"          uuid          NOT NULL DEFAULT uuid_generate_v4(),
                "settingId"   uuid          NOT NULL,
                "category"    varchar(100)  NOT NULL,
                "key"         varchar(200)  NOT NULL,
                "oldValue"    json,
                "newValue"    json          NOT NULL,
                "changedBy"   uuid          NOT NULL,
                "changedAt"   TIMESTAMP(6)  NOT NULL DEFAULT now(),
                CONSTRAINT "PK_admin_settings_history" PRIMARY KEY ("id"),
                CONSTRAINT "FK_admin_settings_history_settingId"
                    FOREIGN KEY ("settingId") REFERENCES "admin_settings"("id")
                    ON DELETE CASCADE,
                CONSTRAINT "FK_admin_settings_history_changedBy"
                    FOREIGN KEY ("changedBy") REFERENCES "users"("id")
                    ON UPDATE NO ACTION
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_admin_settings_history_settingId"    ON "admin_settings_history" ("settingId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_admin_settings_history_category_key" ON "admin_settings_history" ("category", "key")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_admin_settings_history_changedBy"    ON "admin_settings_history" ("changedBy")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_admin_settings_history_changedAt"    ON "admin_settings_history" ("changedAt")`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_settings_history"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_settings"`);
    }
};
