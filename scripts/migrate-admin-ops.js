/**
 * Migration: create all admin-ops tables
 * Safe to run multiple times (IF NOT EXISTS / already-exists suppression)
 */

const { Client } = require('pg');

const DB = {
  host: '72.61.20.94',
  port: 5432,
  database: 'cosmicforge_clean',
  user: 'postgres',
  password: 'wvlAZUDdnEdjpuxEVSZEJkYFwAYJhDEf',
  ssl: false,
};

async function exec(client, label, sql) {
  try {
    await client.query(sql);
    console.log(`✅ ${label}`);
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log(`~ ${label} (already exists)`);
    } else {
      throw new Error(`Failed: ${label}\n   ${e.message}`);
    }
  }
}

async function run() {
  // Retry loop — waits for the system catalog lock (held by a background REINDEX) to clear
  for (let attempt = 1; ; attempt++) {
    try {
      await attempt_migration();
      return;
    } catch (e) {
      if (e.message.includes('lock') || e.message.includes('pg_type') || e.message.includes('duplicate key')) {
        console.log(`\n⏳ Attempt ${attempt} blocked (DB lock still held). Retrying in 30s…`);
        await new Promise(r => setTimeout(r, 30000));
      } else {
        console.error('\n❌ Migration failed:', e.message);
        process.exit(1);
      }
    }
  }
}

async function attempt_migration() {
  const client = new Client(DB);
  await client.connect();
  console.log(`✅ Connected\n`);

  try {
    await client.query("SET lock_timeout = '25s'");
    await client.query("SET statement_timeout = '30s'")

    // ── Enum types ──────────────────────────────────────────────────────────
    await exec(client, 'enum admin_ops_service_status',    `CREATE TYPE admin_ops_service_status    AS ENUM ('up','down','degraded','unknown')`);
    await exec(client, 'enum admin_ops_job_type',          `CREATE TYPE admin_ops_job_type          AS ENUM ('cron','background','scheduled','manual')`);
    await exec(client, 'enum admin_ops_job_status',        `CREATE TYPE admin_ops_job_status        AS ENUM ('pending','running','completed','failed','dead_letter')`);
    await exec(client, 'enum admin_ops_dlj_status',        `CREATE TYPE admin_ops_dlj_status        AS ENUM ('pending_retry','exhausted','manually_resolved')`);
    await exec(client, 'enum admin_ops_incident_severity', `CREATE TYPE admin_ops_incident_severity AS ENUM ('critical','high','medium','low')`);
    await exec(client, 'enum admin_ops_incident_status',   `CREATE TYPE admin_ops_incident_status   AS ENUM ('open','investigating','identified','monitoring','resolved','closed')`);
    await exec(client, 'enum admin_ops_alert_type',        `CREATE TYPE admin_ops_alert_type        AS ENUM ('job_failure','health_degraded','dead_letter','webhook_failure','custom')`);
    await exec(client, 'enum admin_ops_alert_severity',    `CREATE TYPE admin_ops_alert_severity    AS ENUM ('critical','warning','info')`);
    await exec(client, 'enum admin_ops_delivery_status',   `CREATE TYPE admin_ops_delivery_status   AS ENUM ('success','failed','pending')`);

    // ── Tables ──────────────────────────────────────────────────────────────
    await exec(client, 'aops_service_registry', `
      CREATE TABLE IF NOT EXISTS aops_service_registry (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name             VARCHAR(100) NOT NULL UNIQUE,
        "displayName"    VARCHAR(150) NOT NULL,
        "baseUrl"        VARCHAR(500),
        "healthEndpoint" VARCHAR(500),
        status           admin_ops_service_status NOT NULL DEFAULT 'unknown',
        version          VARCHAR(50),
        tags             JSON,
        metadata         JSON,
        "lastCheckedAt"  TIMESTAMP,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await exec(client, 'aops_job_executions', `
      CREATE TABLE IF NOT EXISTS aops_job_executions (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "jobName"     VARCHAR(150) NOT NULL,
        "jobType"     admin_ops_job_type NOT NULL DEFAULT 'cron',
        status        admin_ops_job_status NOT NULL DEFAULT 'pending',
        "startedAt"   TIMESTAMP,
        "completedAt" TIMESTAMP,
        "durationMs"  INT,
        input         JSON,
        output        JSON,
        error         TEXT,
        attempts      INT NOT NULL DEFAULT 1,
        "scheduledAt" TIMESTAMP,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await exec(client, 'aops_dead_letter_jobs', `
      CREATE TABLE IF NOT EXISTS aops_dead_letter_jobs (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "jobExecutionId" UUID,
        "jobName"        VARCHAR(150) NOT NULL,
        payload          JSON,
        "errorMessage"   TEXT,
        "failedAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "retryCount"     INT NOT NULL DEFAULT 0,
        "maxRetries"     INT NOT NULL DEFAULT 3,
        status           admin_ops_dlj_status NOT NULL DEFAULT 'pending_retry',
        "resolvedAt"     TIMESTAMP,
        "resolvedBy"     UUID,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await exec(client, 'aops_webhook_endpoints', `
      CREATE TABLE IF NOT EXISTS aops_webhook_endpoints (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(150) NOT NULL,
        url         VARCHAR(1000) NOT NULL,
        secret      VARCHAR(500),
        events      JSON,
        "isActive"  BOOLEAN NOT NULL DEFAULT TRUE,
        provider    VARCHAR(100),
        headers     JSON,
        description TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await exec(client, 'aops_webhook_delivery_logs', `
      CREATE TABLE IF NOT EXISTS aops_webhook_delivery_logs (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "webhookEndpointId" UUID,
        event               VARCHAR(150) NOT NULL,
        payload             JSON,
        "statusCode"        INT,
        "responseBody"      TEXT,
        attempt             INT NOT NULL DEFAULT 1,
        status              admin_ops_delivery_status NOT NULL DEFAULT 'pending',
        "deliveredAt"       TIMESTAMP,
        error               TEXT,
        provider            VARCHAR(100),
        "createdAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await exec(client, 'aops_incidents', `
      CREATE TABLE IF NOT EXISTS aops_incidents (
        id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title              VARCHAR(300) NOT NULL,
        description        TEXT,
        severity           admin_ops_incident_severity NOT NULL DEFAULT 'medium',
        status             admin_ops_incident_status NOT NULL DEFAULT 'open',
        "affectedServices" JSON,
        "resolvedAt"       TIMESTAMP,
        "resolvedBy"       UUID,
        "createdBy"        UUID,
        metadata           JSON,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await exec(client, 'aops_system_alerts', `
      CREATE TABLE IF NOT EXISTS aops_system_alerts (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type         admin_ops_alert_type NOT NULL DEFAULT 'custom',
        severity     admin_ops_alert_severity NOT NULL DEFAULT 'info',
        message      VARCHAR(500) NOT NULL,
        details      JSON,
        source       VARCHAR(200),
        "isRead"     BOOLEAN NOT NULL DEFAULT FALSE,
        "isResolved" BOOLEAN NOT NULL DEFAULT FALSE,
        "resolvedAt" TIMESTAMP,
        "createdAt"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await exec(client, 'aops_feature_flags', `
      CREATE TABLE IF NOT EXISTS aops_feature_flags (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key                 VARCHAR(100) NOT NULL UNIQUE,
        name                VARCHAR(200) NOT NULL,
        description         TEXT,
        "isEnabled"         BOOLEAN NOT NULL DEFAULT FALSE,
        "enabledFor"        JSON,
        "rolloutPercentage" INT,
        environment         VARCHAR(50) NOT NULL DEFAULT 'all',
        metadata            JSON,
        "createdBy"         UUID,
        "updatedBy"         UUID,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await exec(client, 'aops_health_check_history', `
      CREATE TABLE IF NOT EXISTS aops_health_check_history (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        status           VARCHAR(50) NOT NULL,
        version          VARCHAR(50),
        environment      VARCHAR(50),
        uptime           FLOAT,
        details          JSON,
        "responseTimeMs" INT,
        "checkedAt"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await exec(client, 'aops_environment_configs', `
      CREATE TABLE IF NOT EXISTS aops_environment_configs (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key         VARCHAR(150) NOT NULL,
        value       TEXT,
        description TEXT,
        "isPublic"  BOOLEAN NOT NULL DEFAULT FALSE,
        environment VARCHAR(50) NOT NULL DEFAULT 'all',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('\n════════════════════════════════════════════');
    console.log('  ADMIN-OPS MIGRATION COMPLETE (10 tables)');
    console.log('════════════════════════════════════════════\n');

  } catch (err) {
    await client.end();
    throw err;
  }
  await client.end();
}

run();
