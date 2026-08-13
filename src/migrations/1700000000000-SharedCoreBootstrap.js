module.exports = class SharedCoreBootstrap1700000000000 {
  name = "SharedCoreBootstrap1700000000000";

  async up(queryRunner) {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await this.ensureEnum(queryRunner, "users_role_enum", [
      "patient",
      "doctor",
      "pharmacy",
      "pharmacist",
      "pharmacy_manager",
      "pharmacy_admin",
      "pharmacy_assistant",
      "dispatcher",
      "lab",
      "lab_admin",
      "lab_manager",
      "lab_staff",
      "sample_collector",
      "lab_technician",
      "radiologist",
      "result_reviewer",
      "admin",
      "super_admin",
      "marketer",
      "support",
      "pharmacy_staff",
      "pharmacy_owner"
    ]);

    await this.ensureEnum(queryRunner, "users_status_enum", [
      "pending_email_verification",
      "active",
      "pending_doctor_verification",
      "doctor_active",
      "pending_pharmacy_verification",
      "pharmacy_active",
      "locked"
    ]);

    await this.ensureEnum(queryRunner, "users_provider_enum", ["local", "google"]);
    await this.ensureEnum(queryRunner, "users_tier_enum", [
      "free",
      "basic",
      "standard",
      "medium",
      "premium",
      "gold_elite",
      "professional"
    ]);
    await this.ensureEnum(queryRunner, "chatroom_type_enum", [
      "direct",
      "group",
      "appointment",
      "support",
      "order_chat"
    ]);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fullName" character varying NOT NULL,
        "email" character varying,
        "passwordHash" character varying,
        "username" character varying,
        "bannerUrl" character varying,
        "country" character varying(100),
        "pharmacyId" uuid,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'patient',
        "status" "public"."users_status_enum" NOT NULL DEFAULT 'pending_email_verification',
        "phoneNumber" character varying,
        "departmentSpecialty" character varying,
        "provider" "public"."users_provider_enum" NOT NULL DEFAULT 'local',
        "providerId" character varying,
        "profileImageUrl" character varying,
        "mfaEnabled" boolean NOT NULL DEFAULT false,
        "mfaSecret" character varying,
        "refreshTokenHash" character varying,
        "resetPasswordOTP" character varying,
        "resetPasswordOTPExpires" TIMESTAMP,
        "mustChangePassword" boolean NOT NULL DEFAULT false,
        "passwordChangedAt" TIMESTAMP,
        "lastLoginAt" TIMESTAMP,
        "tier" "public"."users_tier_enum" NOT NULL DEFAULT 'free',
        "isOnline" boolean NOT NULL DEFAULT false,
        "referralCode" character varying(50),
        "totalReferrals" integer NOT NULL DEFAULT 0,
        "referredBy" uuid,
        "timezone" character varying(100),
        "lastDetectedTimezone" character varying(100),
        "timezoneUpdatedAt" TIMESTAMP,
        "averageRating" numeric(2,1) NOT NULL DEFAULT 0.0,
        "totalRatings" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email_unique" ON "users" ("email") WHERE "email" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_username_unique" ON "users" ("username") WHERE "username" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_referralCode_unique" ON "users" ("referralCode") WHERE "referralCode" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_role" ON "users" ("role")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_status" ON "users" ("status")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" varchar(50) NOT NULL,
        "message" text NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "metadata" json,
        "createdAt" TIMESTAMPTZ DEFAULT now(),
        "readAt" TIMESTAMPTZ,
        "userId" uuid NOT NULL,
        "isDeleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_notification_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_NOTIFICATION_USER" ON "notification" ("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_NOTIFICATION_CREATED_AT" ON "notification" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_NOTIFICATION_USER_READ" ON "notification" ("userId", "isRead", "isDeleted")`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_notification_user') THEN
          ALTER TABLE "notification"
          ADD CONSTRAINT "FK_notification_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END;
      $$
    `);
  }

  async down() {
    // No-op: this bootstrap protects shared production tables.
  }

  async ensureEnum(queryRunner, typeName, values) {
    const quotedValues = values.map((value) => `'${value.replace(/'/g, "''")}'`).join(", ");
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typeName}') THEN
          CREATE TYPE "public"."${typeName}" AS ENUM(${quotedValues});
        END IF;
      END;
      $$
    `);

    for (const value of values) {
      await queryRunner.query(`ALTER TYPE "public"."${typeName}" ADD VALUE IF NOT EXISTS '${value.replace(/'/g, "''")}'`);
    }
  }
};
