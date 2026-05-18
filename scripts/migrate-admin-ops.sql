CREATE TABLE IF NOT EXISTS aops_service_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  "displayName" VARCHAR(150) NOT NULL,
  "baseUrl" VARCHAR(500),
  "healthEndpoint" VARCHAR(500),
  status admin_ops_service_status NOT NULL DEFAULT 'unknown',
  version VARCHAR(50),
  tags JSON,
  metadata JSON,
  "lastCheckedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aops_job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobName" VARCHAR(150) NOT NULL,
  "jobType" admin_ops_job_type NOT NULL DEFAULT 'cron',
  status admin_ops_job_status NOT NULL DEFAULT 'pending',
  "startedAt" TIMESTAMP,
  "completedAt" TIMESTAMP,
  "durationMs" INT,
  input JSON,
  output JSON,
  error TEXT,
  attempts INT NOT NULL DEFAULT 1,
  "scheduledAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aops_dead_letter_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobExecutionId" UUID,
  "jobName" VARCHAR(150) NOT NULL,
  payload JSON,
  "errorMessage" TEXT,
  "failedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retryCount" INT NOT NULL DEFAULT 0,
  "maxRetries" INT NOT NULL DEFAULT 3,
  status admin_ops_dlj_status NOT NULL DEFAULT 'pending_retry',
  "resolvedAt" TIMESTAMP,
  "resolvedBy" UUID,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aops_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  secret VARCHAR(500),
  events JSON,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  provider VARCHAR(100),
  headers JSON,
  description TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aops_webhook_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "webhookEndpointId" UUID,
  event VARCHAR(150) NOT NULL,
  payload JSON,
  "statusCode" INT,
  "responseBody" TEXT,
  attempt INT NOT NULL DEFAULT 1,
  status admin_ops_delivery_status NOT NULL DEFAULT 'pending',
  "deliveredAt" TIMESTAMP,
  error TEXT,
  provider VARCHAR(100),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aops_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(300) NOT NULL,
  description TEXT,
  severity admin_ops_incident_severity NOT NULL DEFAULT 'medium',
  status admin_ops_incident_status NOT NULL DEFAULT 'open',
  "affectedServices" JSON,
  "resolvedAt" TIMESTAMP,
  "resolvedBy" UUID,
  "createdBy" UUID,
  metadata JSON,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aops_system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type admin_ops_alert_type NOT NULL DEFAULT 'custom',
  severity admin_ops_alert_severity NOT NULL DEFAULT 'info',
  message VARCHAR(500) NOT NULL,
  details JSON,
  source VARCHAR(200),
  "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
  "isResolved" BOOLEAN NOT NULL DEFAULT FALSE,
  "resolvedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aops_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "enabledFor" JSON,
  "rolloutPercentage" INT,
  environment VARCHAR(50) NOT NULL DEFAULT 'all',
  metadata JSON,
  "createdBy" UUID,
  "updatedBy" UUID,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aops_health_check_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(50) NOT NULL,
  version VARCHAR(50),
  environment VARCHAR(50),
  uptime FLOAT,
  details JSON,
  "responseTimeMs" INT,
  "checkedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aops_environment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(150) NOT NULL,
  value TEXT,
  description TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT FALSE,
  environment VARCHAR(50) NOT NULL DEFAULT 'all',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
