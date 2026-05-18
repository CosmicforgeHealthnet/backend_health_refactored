module.exports = class CreateAdminOps1900000000010 {
    name = 'CreateAdminOps1900000000010';

    async up(queryRunner) {
        // Enums
        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_ops_service_status_enum') THEN
                    CREATE TYPE "public"."admin_ops_service_status_enum" AS ENUM ('up', 'down', 'degraded', 'unknown');
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_ops_job_type_enum') THEN
                    CREATE TYPE "public"."admin_ops_job_type_enum" AS ENUM ('cron', 'background', 'scheduled', 'manual');
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_ops_job_status_enum') THEN
                    CREATE TYPE "public"."admin_ops_job_status_enum" AS ENUM ('pending', 'running', 'completed', 'failed', 'dead_letter');
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_ops_dead_letter_status_enum') THEN
                    CREATE TYPE "public"."admin_ops_dead_letter_status_enum" AS ENUM ('pending_retry', 'exhausted', 'manually_resolved');
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_ops_webhook_delivery_status_enum') THEN
                    CREATE TYPE "public"."admin_ops_webhook_delivery_status_enum" AS ENUM ('success', 'failed', 'pending');
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_ops_incident_severity_enum') THEN
                    CREATE TYPE "public"."admin_ops_incident_severity_enum" AS ENUM ('critical', 'high', 'medium', 'low');
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_ops_incident_status_enum') THEN
                    CREATE TYPE "public"."admin_ops_incident_status_enum" AS ENUM ('open', 'investigating', 'identified', 'monitoring', 'resolved', 'closed');
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_ops_alert_type_enum') THEN
                    CREATE TYPE "public"."admin_ops_alert_type_enum" AS ENUM ('job_failure', 'health_degraded', 'dead_letter', 'webhook_failure', 'custom');
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_ops_alert_severity_enum') THEN
                    CREATE TYPE "public"."admin_ops_alert_severity_enum" AS ENUM ('critical', 'warning', 'info');
                END IF;
            END $$;
        `);

        // Tables
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_ops_service_registry" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" varchar(100) NOT NULL,
                "displayName" varchar(150) NOT NULL,
                "baseUrl" varchar(500),
                "healthEndpoint" varchar(500),
                "status" "public"."admin_ops_service_status_enum" NOT NULL DEFAULT 'unknown',
                "version" varchar(50),
                "tags" json,
                "metadata" json,
                "lastCheckedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_admin_ops_service_registry_name" UNIQUE ("name"),
                CONSTRAINT "PK_admin_ops_service_registry" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_ops_job_executions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "jobName" varchar(150) NOT NULL,
                "jobType" "public"."admin_ops_job_type_enum" NOT NULL DEFAULT 'cron',
                "status" "public"."admin_ops_job_status_enum" NOT NULL DEFAULT 'pending',
                "startedAt" TIMESTAMP,
                "completedAt" TIMESTAMP,
                "durationMs" int,
                "input" json,
                "output" json,
                "error" text,
                "attempts" int NOT NULL DEFAULT 1,
                "scheduledAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_admin_ops_job_executions" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_ops_dead_letter_jobs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "jobExecutionId" uuid,
                "jobName" varchar(150) NOT NULL,
                "payload" json,
                "errorMessage" text,
                "failedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "retryCount" int NOT NULL DEFAULT 0,
                "maxRetries" int NOT NULL DEFAULT 3,
                "status" "public"."admin_ops_dead_letter_status_enum" NOT NULL DEFAULT 'pending_retry',
                "resolvedAt" TIMESTAMP,
                "resolvedBy" uuid,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_admin_ops_dead_letter_jobs" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_ops_webhook_endpoints" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" varchar(150) NOT NULL,
                "url" varchar(1000) NOT NULL,
                "secret" varchar(500),
                "events" json,
                "isActive" boolean NOT NULL DEFAULT true,
                "provider" varchar(100),
                "headers" json,
                "description" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_admin_ops_webhook_endpoints" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_ops_webhook_delivery_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "webhookEndpointId" uuid,
                "event" varchar(150) NOT NULL,
                "payload" json,
                "statusCode" int,
                "responseBody" text,
                "attempt" int NOT NULL DEFAULT 1,
                "status" "public"."admin_ops_webhook_delivery_status_enum" NOT NULL DEFAULT 'pending',
                "deliveredAt" TIMESTAMP,
                "error" text,
                "provider" varchar(100),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_admin_ops_webhook_delivery_logs" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_ops_incidents" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "title" varchar(300) NOT NULL,
                "description" text,
                "severity" "public"."admin_ops_incident_severity_enum" NOT NULL DEFAULT 'medium',
                "status" "public"."admin_ops_incident_status_enum" NOT NULL DEFAULT 'open',
                "affectedServices" json,
                "resolvedAt" TIMESTAMP,
                "resolvedBy" uuid,
                "createdBy" uuid,
                "metadata" json,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_admin_ops_incidents" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_ops_system_alerts" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "type" "public"."admin_ops_alert_type_enum" NOT NULL DEFAULT 'custom',
                "severity" "public"."admin_ops_alert_severity_enum" NOT NULL DEFAULT 'info',
                "message" varchar(500) NOT NULL,
                "details" json,
                "source" varchar(200),
                "isRead" boolean NOT NULL DEFAULT false,
                "isResolved" boolean NOT NULL DEFAULT false,
                "resolvedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_admin_ops_system_alerts" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_ops_feature_flags" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "key" varchar(100) NOT NULL,
                "name" varchar(200) NOT NULL,
                "description" text,
                "isEnabled" boolean NOT NULL DEFAULT false,
                "enabledFor" json,
                "rolloutPercentage" int,
                "environment" varchar(50) NOT NULL DEFAULT 'all',
                "metadata" json,
                "createdBy" uuid,
                "updatedBy" uuid,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_admin_ops_feature_flags_key" UNIQUE ("key"),
                CONSTRAINT "PK_admin_ops_feature_flags" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_ops_health_check_history" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "status" varchar(50) NOT NULL,
                "version" varchar(50),
                "environment" varchar(50),
                "uptime" float,
                "details" json,
                "responseTimeMs" int,
                "checkedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_admin_ops_health_check_history" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_ops_environment_configs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "key" varchar(150) NOT NULL,
                "value" text,
                "description" text,
                "isPublic" boolean NOT NULL DEFAULT false,
                "environment" varchar(50) NOT NULL DEFAULT 'all',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_admin_ops_environment_configs" PRIMARY KEY ("id")
            )
        `);

        // Indexes for common query patterns
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_admin_ops_job_executions_jobName" ON "admin_ops_job_executions" ("jobName")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_admin_ops_job_executions_status" ON "admin_ops_job_executions" ("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_admin_ops_dead_letter_status" ON "admin_ops_dead_letter_jobs" ("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_admin_ops_webhook_logs_event" ON "admin_ops_webhook_delivery_logs" ("event")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_admin_ops_alerts_isResolved" ON "admin_ops_system_alerts" ("isResolved")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_admin_ops_health_checkedAt" ON "admin_ops_health_check_history" ("checkedAt")`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_ops_environment_configs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_ops_health_check_history"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_ops_feature_flags"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_ops_system_alerts"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_ops_incidents"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_ops_webhook_delivery_logs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_ops_webhook_endpoints"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_ops_dead_letter_jobs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_ops_job_executions"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_ops_service_registry"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."admin_ops_alert_severity_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."admin_ops_alert_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."admin_ops_incident_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."admin_ops_incident_severity_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."admin_ops_webhook_delivery_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."admin_ops_dead_letter_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."admin_ops_job_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."admin_ops_job_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."admin_ops_service_status_enum"`);
    }
};
