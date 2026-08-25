// config/database.js does `module.exports = AppDataSource` (a plain TypeORM
// DataSource instance, not `{ AppDataSource }`) — destructuring made this
// undefined, so every AppDataSource.getRepository(...) call here threw.
const AppDataSource = require('../../../config/database');

const getRepo = (entityName) => AppDataSource.getRepository(entityName);

// ─── Service Registry ───────────────────────────────────────────────────────

async function listServices() {
    return getRepo('ServiceRegistry').find({ order: { name: 'ASC' } });
}

async function createService(data) {
    const repo = getRepo('ServiceRegistry');
    const entity = repo.create(data);
    return repo.save(entity);
}

async function getService(id) {
    const svc = await getRepo('ServiceRegistry').findOneBy({ id });
    if (!svc) throw new Error('Service not found');
    return svc;
}

async function updateService(id, data) {
    const repo = getRepo('ServiceRegistry');
    await repo.update(id, data);
    return repo.findOneBy({ id });
}

async function deleteService(id) {
    return getRepo('ServiceRegistry').delete(id);
}

// ─── Job Executions ─────────────────────────────────────────────────────────

async function listJobExecutions({ status, jobName, limit = 50, offset = 0 } = {}) {
    const where = {};
    if (status) where.status = status;
    if (jobName) where.jobName = jobName;
    return getRepo('JobExecution').find({
        where,
        order: { createdAt: 'DESC' },
        take: Math.min(limit, 200),
        skip: offset,
    });
}

async function getJobExecution(id) {
    const job = await getRepo('JobExecution').findOneBy({ id });
    if (!job) throw new Error('Job execution not found');
    return job;
}

async function createJobExecution(data) {
    const repo = getRepo('JobExecution');
    const entity = repo.create(data);
    return repo.save(entity);
}

async function updateJobExecution(id, data) {
    await getRepo('JobExecution').update(id, data);
    return getRepo('JobExecution').findOneBy({ id });
}

// ─── Dead Letter Jobs ────────────────────────────────────────────────────────

async function listDeadLetterJobs({ status, limit = 50, offset = 0 } = {}) {
    const where = {};
    if (status) where.status = status;
    return getRepo('DeadLetterJob').find({
        where,
        order: { failedAt: 'DESC' },
        take: Math.min(limit, 200),
        skip: offset,
    });
}

async function getDeadLetterJob(id) {
    const dlj = await getRepo('DeadLetterJob').findOneBy({ id });
    if (!dlj) throw new Error('Dead letter job not found');
    return dlj;
}

async function createDeadLetterJob(data) {
    const repo = getRepo('DeadLetterJob');
    const entity = repo.create(data);
    return repo.save(entity);
}

async function resolveDeadLetterJob(id, resolvedBy) {
    await getRepo('DeadLetterJob').update(id, {
        status: 'manually_resolved',
        resolvedAt: new Date(),
        resolvedBy,
    });
    return getRepo('DeadLetterJob').findOneBy({ id });
}

// ─── Webhook Endpoints ───────────────────────────────────────────────────────

async function listWebhookEndpoints() {
    return getRepo('WebhookEndpoint').find({ order: { createdAt: 'DESC' } });
}

async function createWebhookEndpoint(data) {
    const repo = getRepo('WebhookEndpoint');
    const entity = repo.create(data);
    return repo.save(entity);
}

async function getWebhookEndpoint(id) {
    const wh = await getRepo('WebhookEndpoint').findOneBy({ id });
    if (!wh) throw new Error('Webhook endpoint not found');
    return wh;
}

async function updateWebhookEndpoint(id, data) {
    await getRepo('WebhookEndpoint').update(id, data);
    return getRepo('WebhookEndpoint').findOneBy({ id });
}

async function deleteWebhookEndpoint(id) {
    return getRepo('WebhookEndpoint').delete(id);
}

// ─── Webhook Delivery Logs ───────────────────────────────────────────────────

async function listWebhookDeliveryLogs({ webhookEndpointId, event, status, limit = 50, offset = 0 } = {}) {
    const where = {};
    if (webhookEndpointId) where.webhookEndpointId = webhookEndpointId;
    if (event) where.event = event;
    if (status) where.status = status;
    return getRepo('WebhookDeliveryLog').find({
        where,
        order: { createdAt: 'DESC' },
        take: Math.min(limit, 200),
        skip: offset,
    });
}

async function createWebhookDeliveryLog(data) {
    const repo = getRepo('WebhookDeliveryLog');
    const entity = repo.create(data);
    return repo.save(entity);
}

async function getWebhookDeliveryLog(id) {
    const log = await getRepo('WebhookDeliveryLog').findOneBy({ id });
    if (!log) throw new Error('Webhook delivery log not found');
    return log;
}

// ─── Incidents ───────────────────────────────────────────────────────────────

async function listIncidents({ status, severity, limit = 50, offset = 0 } = {}) {
    const where = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    return getRepo('Incident').find({
        where,
        order: { createdAt: 'DESC' },
        take: Math.min(limit, 200),
        skip: offset,
    });
}

async function createIncident(data) {
    const repo = getRepo('Incident');
    const entity = repo.create(data);
    return repo.save(entity);
}

async function getIncident(id) {
    const incident = await getRepo('Incident').findOneBy({ id });
    if (!incident) throw new Error('Incident not found');
    return incident;
}

async function updateIncident(id, data) {
    await getRepo('Incident').update(id, data);
    return getRepo('Incident').findOneBy({ id });
}

async function resolveIncident(id, resolvedBy) {
    await getRepo('Incident').update(id, {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy,
    });
    return getRepo('Incident').findOneBy({ id });
}

// ─── System Alerts ───────────────────────────────────────────────────────────

async function listAlerts({ isResolved, severity, limit = 50, offset = 0 } = {}) {
    const where = {};
    if (isResolved !== undefined) where.isResolved = isResolved;
    if (severity) where.severity = severity;
    return getRepo('SystemAlert').find({
        where,
        order: { createdAt: 'DESC' },
        take: Math.min(limit, 200),
        skip: offset,
    });
}

async function createAlert(data) {
    const repo = getRepo('SystemAlert');
    const entity = repo.create(data);
    return repo.save(entity);
}

async function getAlert(id) {
    const alert = await getRepo('SystemAlert').findOneBy({ id });
    if (!alert) throw new Error('Alert not found');
    return alert;
}

async function markAlertRead(id) {
    await getRepo('SystemAlert').update(id, { isRead: true });
    return getRepo('SystemAlert').findOneBy({ id });
}

async function resolveAlert(id) {
    await getRepo('SystemAlert').update(id, { isResolved: true, resolvedAt: new Date() });
    return getRepo('SystemAlert').findOneBy({ id });
}

// ─── Feature Flags ───────────────────────────────────────────────────────────

async function listFeatureFlags() {
    return getRepo('FeatureFlag').find({ order: { key: 'ASC' } });
}

async function createFeatureFlag(data) {
    const repo = getRepo('FeatureFlag');
    const entity = repo.create(data);
    return repo.save(entity);
}

async function getFeatureFlagByKey(key) {
    const flag = await getRepo('FeatureFlag').findOneBy({ key });
    if (!flag) throw new Error('Feature flag not found');
    return flag;
}

async function updateFeatureFlag(key, data, updatedBy) {
    await getRepo('FeatureFlag').update({ key }, { ...data, updatedBy });
    return getRepo('FeatureFlag').findOneBy({ key });
}

async function deleteFeatureFlag(key) {
    return getRepo('FeatureFlag').delete({ key });
}

async function checkFeatureFlag(key) {
    const flag = await getRepo('FeatureFlag').findOneBy({ key });
    if (!flag) return { enabled: false, exists: false };
    return { enabled: flag.isEnabled, exists: true, rolloutPercentage: flag.rolloutPercentage, environment: flag.environment };
}

// ─── Health Check History ────────────────────────────────────────────────────

async function listHealthHistory({ limit = 50, offset = 0 } = {}) {
    return getRepo('HealthCheckHistory').find({
        order: { checkedAt: 'DESC' },
        take: Math.min(limit, 200),
        skip: offset,
    });
}

async function getLatestHealthCheck() {
    return getRepo('HealthCheckHistory').findOne({ order: { checkedAt: 'DESC' } });
}

async function recordHealthCheck(data) {
    const repo = getRepo('HealthCheckHistory');
    const entity = repo.create(data);
    return repo.save(entity);
}

// ─── Environment Configs ─────────────────────────────────────────────────────

async function listEnvConfigs() {
    const configs = await getRepo('EnvironmentConfig').find({ order: { key: 'ASC' } });
    return configs.map((c) => ({
        ...c,
        value: c.isPublic ? c.value : '***',
    }));
}

async function createEnvConfig(data) {
    const repo = getRepo('EnvironmentConfig');
    const entity = repo.create(data);
    return repo.save(entity);
}

async function updateEnvConfig(id, data) {
    await getRepo('EnvironmentConfig').update(id, data);
    const updated = await getRepo('EnvironmentConfig').findOneBy({ id });
    return { ...updated, value: updated.isPublic ? updated.value : '***' };
}

async function deleteEnvConfig(id) {
    return getRepo('EnvironmentConfig').delete(id);
}

module.exports = {
    listServices, createService, getService, updateService, deleteService,
    listJobExecutions, getJobExecution, createJobExecution, updateJobExecution,
    listDeadLetterJobs, getDeadLetterJob, createDeadLetterJob, resolveDeadLetterJob,
    listWebhookEndpoints, createWebhookEndpoint, getWebhookEndpoint, updateWebhookEndpoint, deleteWebhookEndpoint,
    listWebhookDeliveryLogs, createWebhookDeliveryLog, getWebhookDeliveryLog,
    listIncidents, createIncident, getIncident, updateIncident, resolveIncident,
    listAlerts, createAlert, getAlert, markAlertRead, resolveAlert,
    listFeatureFlags, createFeatureFlag, getFeatureFlagByKey, updateFeatureFlag, deleteFeatureFlag, checkFeatureFlag,
    listHealthHistory, getLatestHealthCheck, recordHealthCheck,
    listEnvConfigs, createEnvConfig, updateEnvConfig, deleteEnvConfig,
};
