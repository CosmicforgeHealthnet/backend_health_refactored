const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRoles } = require('../../auth/middlewares/authMiddleware');
const ctrl = require('../controllers/adminOpsController');

// All management routes require admin or super_admin
router.use(authenticateJWT);
router.use(authorizeRoles('admin', 'super_admin'));

// ─── Service Registry ────────────────────────────────────────────────────────
router.get('/services', ctrl.listServices);
router.post('/services', ctrl.createService);
router.get('/services/:id', ctrl.getService);
router.put('/services/:id', ctrl.updateService);
router.delete('/services/:id', ctrl.deleteService);
router.post('/services/:id/ping', ctrl.pingService);

// ─── Job Monitoring / Background Job Tracking ────────────────────────────────
router.get('/jobs', ctrl.listJobExecutions);
router.get('/jobs/:id', ctrl.getJobExecution);
router.post('/jobs/track', ctrl.trackJobManual);

// ─── Dead Letter Tracking ────────────────────────────────────────────────────
router.get('/dead-letters', ctrl.listDeadLetterJobs);
router.get('/dead-letters/:id', ctrl.getDeadLetterJob);
router.put('/dead-letters/:id/resolve', ctrl.resolveDeadLetterJob);

// ─── Webhook Management ──────────────────────────────────────────────────────
router.get('/webhooks', ctrl.listWebhookEndpoints);
router.post('/webhooks', ctrl.createWebhookEndpoint);
router.get('/webhooks/:id', ctrl.getWebhookEndpoint);
router.put('/webhooks/:id', ctrl.updateWebhookEndpoint);
router.delete('/webhooks/:id', ctrl.deleteWebhookEndpoint);

// ─── Webhook Delivery Logs ───────────────────────────────────────────────────
router.get('/webhook-logs', ctrl.listWebhookDeliveryLogs);
router.get('/webhook-logs/:id', ctrl.getWebhookDeliveryLog);

// ─── Incident Tracking ───────────────────────────────────────────────────────
router.get('/incidents', ctrl.listIncidents);
router.post('/incidents', ctrl.createIncident);
router.get('/incidents/:id', ctrl.getIncident);
router.put('/incidents/:id', ctrl.updateIncident);
router.post('/incidents/:id/resolve', ctrl.resolveIncident);

// ─── System Alerts ───────────────────────────────────────────────────────────
router.get('/alerts', ctrl.listAlerts);
router.post('/alerts', ctrl.createAlert);
router.get('/alerts/:id', ctrl.getAlert);
router.put('/alerts/:id/read', ctrl.markAlertRead);
router.put('/alerts/:id/resolve', ctrl.resolveAlert);

// ─── Feature Flags ───────────────────────────────────────────────────────────
router.get('/flags', ctrl.listFeatureFlags);
router.post('/flags', ctrl.createFeatureFlag);
router.get('/flags/:key', ctrl.getFeatureFlag);
router.put('/flags/:key', ctrl.updateFeatureFlag);
router.delete('/flags/:key', ctrl.deleteFeatureFlag);
// Public check endpoint — skip admin auth for this one (mounted separately in app.js)
router.get('/flags/:key/check', ctrl.checkFeatureFlag);

// ─── Health Check History ────────────────────────────────────────────────────
router.get('/health-history', ctrl.listHealthHistory);
router.get('/health-history/latest', ctrl.getLatestHealthCheck);

// ─── Environment Configs ─────────────────────────────────────────────────────
router.get('/env-configs', ctrl.listEnvConfigs);
router.post('/env-configs', ctrl.createEnvConfig);
router.put('/env-configs/:id', ctrl.updateEnvConfig);
router.delete('/env-configs/:id', ctrl.deleteEnvConfig);

module.exports = router;
