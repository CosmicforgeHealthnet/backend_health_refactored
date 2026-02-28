module.exports = class CreateServiceAvailabilityTables1761500000000 {
  async up(queryRunner) {
    // Create enum for service status
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE service_status_enum AS ENUM ('active', 'down');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create enum for status change actions
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE status_change_action_enum AS ENUM (
          'manual_down',
          'manual_active',
          'auto_reactivated',
          'countdown_extended',
          'countdown_shortened',
          'override_active',
          'created'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create service_availability table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "service_availability" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "serviceKey" VARCHAR(100) NOT NULL UNIQUE,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "status" service_status_enum NOT NULL DEFAULT 'active',
        "countdownEnd" TIMESTAMP WITH TIME ZONE,
        "downtimeReason" TEXT,
        "downtimeMessage" TEXT,
        "showCountdown" BOOLEAN NOT NULL DEFAULT true,
        "lastUpdatedBy" UUID,
        "iconUrl" VARCHAR(500),
        "category" VARCHAR(100),
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "isEnabled" BOOLEAN NOT NULL DEFAULT true,
        "isDeleted" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_service_availability_user" FOREIGN KEY ("lastUpdatedBy")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Create service_status_history table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "service_status_history" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "serviceId" UUID NOT NULL,
        "previousStatus" VARCHAR(50),
        "newStatus" VARCHAR(50) NOT NULL,
        "action" status_change_action_enum NOT NULL,
        "previousCountdownEnd" TIMESTAMP WITH TIME ZONE,
        "newCountdownEnd" TIMESTAMP WITH TIME ZONE,
        "reason" TEXT,
        "changedBy" UUID,
        "notificationsSent" BOOLEAN NOT NULL DEFAULT false,
        "notificationCount" INTEGER NOT NULL DEFAULT 0,
        "downtimeDurationMinutes" INTEGER,
        "ipAddress" VARCHAR(45),
        "userAgent" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_service_status_history_service" FOREIGN KEY ("serviceId")
          REFERENCES "service_availability"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_service_status_history_user" FOREIGN KEY ("changedBy")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes for service_availability
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_availability_serviceKey"
      ON "service_availability" ("serviceKey")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_availability_status"
      ON "service_availability" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_availability_category"
      ON "service_availability" ("category")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_availability_isEnabled"
      ON "service_availability" ("isEnabled")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_availability_isDeleted"
      ON "service_availability" ("isDeleted")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_availability_countdownEnd"
      ON "service_availability" ("countdownEnd")
    `);

    // Create indexes for service_status_history
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_status_history_serviceId"
      ON "service_status_history" ("serviceId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_status_history_action"
      ON "service_status_history" ("action")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_status_history_changedBy"
      ON "service_status_history" ("changedBy")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_status_history_createdAt"
      ON "service_status_history" ("createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_status_history_newStatus"
      ON "service_status_history" ("newStatus")
    `);

    console.log('Service availability tables created successfully');
  }

  async down(queryRunner) {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_status_history_newStatus"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_status_history_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_status_history_changedBy"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_status_history_action"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_status_history_serviceId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_availability_countdownEnd"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_availability_isDeleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_availability_isEnabled"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_availability_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_availability_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_availability_serviceKey"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "service_status_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_availability"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS status_change_action_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS service_status_enum`);

    console.log('Service availability tables dropped successfully');
  }
};
