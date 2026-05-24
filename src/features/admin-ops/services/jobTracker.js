const logger = require('../../../config/logger');
const { getSetting } = require('../../../shared/services/adminSettingsService');

let _service = null;
const getService = () => {
    if (!_service) _service = require('./adminOpsService');
    return _service;
};

/**
 * Wraps an async job function to automatically track its execution and
 * push to dead-letter on failure. Drop-in for existing cron job functions.
 *
 * Usage in cron.js:
 *   const { trackJob } = require('./features/admin-ops/services/jobTracker');
 *   cron.schedule('0 0 * * *', trackJob('subscription-expiry', 'cron', async () => {
 *       await subscriptionExpiryJob();
 *   }));
 */
function trackJob(jobName, jobType = 'cron', fn) {
    return async (...args) => {
        const svc = getService();
        let execId = null;
        const start = Date.now();

        try {
            const exec = await svc.createJobExecution({
                jobName,
                jobType,
                status: 'running',
                startedAt: new Date(),
            });
            execId = exec.id;
        } catch (dbErr) {
            logger.warn(`[jobTracker] Could not record start for ${jobName}: ${dbErr.message}`);
        }

        try {
            const result = await fn(...args);
            const durationMs = Date.now() - start;

            if (execId) {
                await svc.updateJobExecution(execId, {
                    status: 'completed',
                    completedAt: new Date(),
                    durationMs,
                    output: result ? { result } : null,
                }).catch(() => {});
            }

            return result;
        } catch (err) {
            const durationMs = Date.now() - start;
            logger.error(`[jobTracker] Job ${jobName} failed: ${err.message}`);

            if (execId) {
                await svc.updateJobExecution(execId, {
                    status: 'failed',
                    completedAt: new Date(),
                    durationMs,
                    error: err.message,
                }).catch(() => {});
            }

            // Push to dead-letter — maxRetries from admin_settings (limits.event_retry_attempts)
            try {
                const retrySetting = await getSetting('limits', 'event_retry_attempts', { enabled: true, value: 3 });
                const maxRetries = (retrySetting?.enabled !== false && retrySetting?.value) ? retrySetting.value : 3;

                await svc.createDeadLetterJob({
                    jobExecutionId: execId,
                    jobName,
                    errorMessage: err.message,
                    payload: { args: args.length ? args : undefined },
                    maxRetries,
                });

                // Fire a system alert
                await svc.createAlert({
                    type: 'job_failure',
                    severity: 'warning',
                    message: `Job "${jobName}" failed`,
                    source: jobName,
                    details: { error: err.message, durationMs },
                });
            } catch (dlErr) {
                logger.warn(`[jobTracker] Could not write dead-letter for ${jobName}: ${dlErr.message}`);
            }

            throw err;
        }
    };
}

/**
 * Manually log a webhook delivery result. Call this inside existing webhook handlers.
 *
 * Usage:
 *   const { logWebhookDelivery } = require('../admin-ops/services/jobTracker');
 *   await logWebhookDelivery({ event: 'payment.success', provider: 'flutterwave', statusCode: 200, payload: req.body });
 */
async function logWebhookDelivery({ event, provider, statusCode, payload, responseBody, error } = {}) {
    try {
        const svc = getService();
        const status = statusCode && statusCode < 400 ? 'success' : 'failed';
        await svc.createWebhookDeliveryLog({
            event,
            provider,
            statusCode,
            payload,
            responseBody,
            error,
            status,
            deliveredAt: new Date(),
        });

        if (status === 'failed') {
            await svc.createAlert({
                type: 'webhook_failure',
                severity: 'warning',
                message: `Webhook delivery failed for event "${event}"`,
                source: provider || 'unknown',
                details: { statusCode, error },
            }).catch(() => {});
        }
    } catch (err) {
        logger.warn(`[jobTracker] Could not log webhook delivery: ${err.message}`);
    }
}

module.exports = { trackJob, logWebhookDelivery };
