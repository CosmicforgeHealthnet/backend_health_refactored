const svc = require('../services/adminOpsService');

// ─── Service Registry ────────────────────────────────────────────────────────

exports.listServices = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.listServices() });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.createService = async (req, res) => {
    try {
        const { name, displayName, baseUrl, healthEndpoint, version, tags, metadata } = req.body;
        if (!name || !displayName) return res.status(400).json({ success: false, message: 'name and displayName are required' });
        res.status(201).json({ success: true, data: await svc.createService({ name, displayName, baseUrl, healthEndpoint, version, tags, metadata }) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.getService = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.getService(req.params.id) });
    } catch (e) {
        res.status(404).json({ success: false, message: e.message });
    }
};

exports.updateService = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.updateService(req.params.id, req.body) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.deleteService = async (req, res) => {
    try {
        await svc.deleteService(req.params.id);
        res.json({ success: true, message: 'Service deregistered' });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.pingService = async (req, res) => {
    try {
        const service = await svc.getService(req.params.id);
        if (!service.healthEndpoint) {
            return res.status(400).json({ success: false, message: 'No health endpoint configured for this service' });
        }
        const axios = require('axios');
        const start = Date.now();
        let status = 'unknown';
        try {
            const response = await axios.get(service.healthEndpoint, { timeout: 5000 });
            status = response.status < 400 ? 'up' : 'degraded';
        } catch {
            status = 'down';
        }
        const updated = await svc.updateService(req.params.id, { status, lastCheckedAt: new Date() });
        res.json({ success: true, data: updated, responseTimeMs: Date.now() - start });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// ─── Job Executions ──────────────────────────────────────────────────────────

exports.listJobExecutions = async (req, res) => {
    try {
        const { status, jobName, limit, offset } = req.query;
        res.json({ success: true, data: await svc.listJobExecutions({ status, jobName, limit: +limit, offset: +offset }) });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.getJobExecution = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.getJobExecution(req.params.id) });
    } catch (e) {
        res.status(404).json({ success: false, message: e.message });
    }
};

exports.trackJobManual = async (req, res) => {
    try {
        const { jobName, jobType, status, startedAt, completedAt, durationMs, input, output, error } = req.body;
        if (!jobName) return res.status(400).json({ success: false, message: 'jobName is required' });
        res.status(201).json({ success: true, data: await svc.createJobExecution({ jobName, jobType, status, startedAt, completedAt, durationMs, input, output, error }) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

// ─── Dead Letter Jobs ────────────────────────────────────────────────────────

exports.listDeadLetterJobs = async (req, res) => {
    try {
        const { status, limit, offset } = req.query;
        res.json({ success: true, data: await svc.listDeadLetterJobs({ status, limit: +limit, offset: +offset }) });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.getDeadLetterJob = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.getDeadLetterJob(req.params.id) });
    } catch (e) {
        res.status(404).json({ success: false, message: e.message });
    }
};

exports.resolveDeadLetterJob = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.resolveDeadLetterJob(req.params.id, req.user?.sub) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

// ─── Webhook Endpoints ───────────────────────────────────────────────────────

exports.listWebhookEndpoints = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.listWebhookEndpoints() });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.createWebhookEndpoint = async (req, res) => {
    try {
        const { name, url, secret, events, isActive, provider, headers, description } = req.body;
        if (!name || !url) return res.status(400).json({ success: false, message: 'name and url are required' });
        res.status(201).json({ success: true, data: await svc.createWebhookEndpoint({ name, url, secret, events, isActive, provider, headers, description }) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.getWebhookEndpoint = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.getWebhookEndpoint(req.params.id) });
    } catch (e) {
        res.status(404).json({ success: false, message: e.message });
    }
};

exports.updateWebhookEndpoint = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.updateWebhookEndpoint(req.params.id, req.body) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.deleteWebhookEndpoint = async (req, res) => {
    try {
        await svc.deleteWebhookEndpoint(req.params.id);
        res.json({ success: true, message: 'Webhook endpoint deleted' });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

// ─── Webhook Delivery Logs ───────────────────────────────────────────────────

exports.listWebhookDeliveryLogs = async (req, res) => {
    try {
        const { webhookEndpointId, event, status, limit, offset } = req.query;
        res.json({ success: true, data: await svc.listWebhookDeliveryLogs({ webhookEndpointId, event, status, limit: +limit, offset: +offset }) });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.getWebhookDeliveryLog = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.getWebhookDeliveryLog(req.params.id) });
    } catch (e) {
        res.status(404).json({ success: false, message: e.message });
    }
};

// ─── Incidents ───────────────────────────────────────────────────────────────

exports.listIncidents = async (req, res) => {
    try {
        const { status, severity, limit, offset } = req.query;
        res.json({ success: true, data: await svc.listIncidents({ status, severity, limit: +limit, offset: +offset }) });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.createIncident = async (req, res) => {
    try {
        const { title, description, severity, affectedServices, metadata } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'title is required' });
        res.status(201).json({ success: true, data: await svc.createIncident({ title, description, severity, affectedServices, metadata, createdBy: req.user?.sub }) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.getIncident = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.getIncident(req.params.id) });
    } catch (e) {
        res.status(404).json({ success: false, message: e.message });
    }
};

exports.updateIncident = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.updateIncident(req.params.id, req.body) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.resolveIncident = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.resolveIncident(req.params.id, req.user?.sub) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

// ─── System Alerts ───────────────────────────────────────────────────────────

exports.listAlerts = async (req, res) => {
    try {
        const { isResolved, severity, limit, offset } = req.query;
        const resolvedBool = isResolved !== undefined ? isResolved === 'true' : undefined;
        res.json({ success: true, data: await svc.listAlerts({ isResolved: resolvedBool, severity, limit: +limit, offset: +offset }) });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.createAlert = async (req, res) => {
    try {
        const { type, severity, message, details, source } = req.body;
        if (!message) return res.status(400).json({ success: false, message: 'message is required' });
        res.status(201).json({ success: true, data: await svc.createAlert({ type, severity, message, details, source }) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.getAlert = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.getAlert(req.params.id) });
    } catch (e) {
        res.status(404).json({ success: false, message: e.message });
    }
};

exports.markAlertRead = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.markAlertRead(req.params.id) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.resolveAlert = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.resolveAlert(req.params.id) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

// ─── Feature Flags ───────────────────────────────────────────────────────────

exports.listFeatureFlags = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.listFeatureFlags() });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.createFeatureFlag = async (req, res) => {
    try {
        const { key, name, description, isEnabled, enabledFor, rolloutPercentage, environment, metadata } = req.body;
        if (!key || !name) return res.status(400).json({ success: false, message: 'key and name are required' });
        res.status(201).json({ success: true, data: await svc.createFeatureFlag({ key, name, description, isEnabled, enabledFor, rolloutPercentage, environment, metadata, createdBy: req.user?.sub }) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.getFeatureFlag = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.getFeatureFlagByKey(req.params.key) });
    } catch (e) {
        res.status(404).json({ success: false, message: e.message });
    }
};

exports.updateFeatureFlag = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.updateFeatureFlag(req.params.key, req.body, req.user?.sub) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.deleteFeatureFlag = async (req, res) => {
    try {
        await svc.deleteFeatureFlag(req.params.key);
        res.json({ success: true, message: 'Feature flag deleted' });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.checkFeatureFlag = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.checkFeatureFlag(req.params.key) });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// ─── Health Check History ────────────────────────────────────────────────────

exports.listHealthHistory = async (req, res) => {
    try {
        const { limit, offset } = req.query;
        res.json({ success: true, data: await svc.listHealthHistory({ limit: +limit, offset: +offset }) });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.getLatestHealthCheck = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.getLatestHealthCheck() });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// ─── Environment Configs ─────────────────────────────────────────────────────

exports.listEnvConfigs = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.listEnvConfigs() });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.createEnvConfig = async (req, res) => {
    try {
        const { key, value, description, isPublic, environment } = req.body;
        if (!key) return res.status(400).json({ success: false, message: 'key is required' });
        res.status(201).json({ success: true, data: await svc.createEnvConfig({ key, value, description, isPublic, environment }) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.updateEnvConfig = async (req, res) => {
    try {
        res.json({ success: true, data: await svc.updateEnvConfig(req.params.id, req.body) });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};

exports.deleteEnvConfig = async (req, res) => {
    try {
        await svc.deleteEnvConfig(req.params.id);
        res.json({ success: true, message: 'Config deleted' });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};
