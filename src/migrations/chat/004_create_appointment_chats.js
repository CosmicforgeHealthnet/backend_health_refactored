const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class CreateAppointmentChats1728705840000 {
  async up(queryRunner) {
    // Create the enum type for appointment status
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_chat_status') THEN
          CREATE TYPE appointment_chat_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled');
        END IF;
      END $$;
    `);

    // Create the appointmentChats table with camelCase columns
    await queryRunner.query(`
      CREATE TABLE "appointment_chats" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "status" appointment_chat_status DEFAULT 'scheduled',
        "scheduledStartTime" TIMESTAMP NOT NULL,
        "scheduledEndTime" TIMESTAMP NOT NULL,
        "actualStartTime" TIMESTAMP,
        "actualEndTime" TIMESTAMP,
        "autoCloseEnabled" BOOLEAN DEFAULT true,
        "preJoinAllowed" BOOLEAN DEFAULT false,
        "postChatDuration" INT DEFAULT 300,
        "settings" JSONB,
        "roomId" UUID NOT NULL,
        "appointmentId" UUID,
        "doctorId" UUID NOT NULL,
        "patientId" UUID NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_appointment_room" FOREIGN KEY ("roomId") REFERENCES "chat_rooms" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_appointment" FOREIGN KEY ("appointmentId") REFERENCES "appointments" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_appointment_doctor" FOREIGN KEY ("doctorId") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_appointment_patient" FOREIGN KEY ("patientId") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);

    // Create indexes for camelCase fields
    await queryRunner.query(`CREATE INDEX "IDX_APPOINTMENT_CHAT_STATUS" ON "appointment_chats" ("status");`);
    await queryRunner.query(`CREATE INDEX "IDX_APPOINTMENT_CHAT_SCHEDULED_START" ON "appointment_chats" ("scheduledStartTime");`);
    await queryRunner.query(`CREATE INDEX "IDX_APPOINTMENT_CHAT_DOCTOR" ON "appointment_chats" ("doctorId");`);
    await queryRunner.query(`CREATE INDEX "IDX_APPOINTMENT_CHAT_PATIENT" ON "appointment_chats" ("patientId");`);
  }

  async down(queryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "appointment_chats";`);

    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_chat_status') THEN
          DROP TYPE appointment_chat_status;
        END IF;
      END $$;
    `);
  }
};
