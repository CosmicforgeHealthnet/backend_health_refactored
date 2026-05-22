// src/features/auth/middlewares/securitySettingsMiddleware.js
//
// Enforces three admin-configurable security settings:
//   security.auto_logout        — inactivity timeout per authenticated user
//   security.require_confirmation — critical admin actions need X-Admin-Confirm: true
//   security.two_step_verification — admin actions need X-Admin-2Step-Token header

const cache = require('../../../shared/utils/cache');
const { getSetting, isSettingEnabled } = require('../../../shared/services/adminSettingsService');

// ─── Auto-Logout ─────────────────────────────────────────────────────────────

const ACTIVITY_TTL_SECONDS = 3600; // max we'll keep an activity entry in cache
const ACTIVITY_PREFIX = 'user_last_activity:';

function activityKey(userId) {
    return `${ACTIVITY_PREFIX}${userId}`;
}

/**
 * Track last activity timestamp for every authenticated user.
 * Must run AFTER authenticateJWT so req.user is populated.
 * Attach to your app-level middleware chain (before routes).
 */
async function trackUserActivity(req, res, next) {
    if (req.user?.sub) {
        try {
            await cache.set(activityKey(req.user.sub), Date.now().toString(), ACTIVITY_TTL_SECONDS);
        } catch { /* cache errors must never break the request */ }
    }
    next();
}

/**
 * Enforce inactivity auto-logout.
 * If security.auto_logout is enabled and the user has been idle longer than
 * the configured duration, reject with 401 so the client re-authenticates.
 *
 * Must run AFTER authenticateJWT and trackUserActivity.
 */
async function enforceAutoLogout(req, res, next) {
    if (!req.user?.sub) return next();

    try {
        const setting = await getSetting('security', 'auto_logout', null);
        if (!setting || setting.enabled === false || !setting.value) return next();

        const u = (setting.unit || '').toLowerCase();
        let thresholdMs;
        if (u === 'minutes' || u === 'minute') thresholdMs = setting.value * 60 * 1000;
        else if (u === 'hours' || u === 'hour') thresholdMs = setting.value * 60 * 60 * 1000;
        else if (u === 'days'  || u === 'day')  thresholdMs = setting.value * 24 * 60 * 60 * 1000;
        else return next(); // unrecognised unit — skip

        const lastActivityRaw = await cache.get(activityKey(req.user.sub));
        if (!lastActivityRaw) {
            // No activity recorded yet — first request in this session, allow it and record now
            await cache.set(activityKey(req.user.sub), Date.now().toString(), ACTIVITY_TTL_SECONDS);
            return next();
        }

        const idle = Date.now() - Number(lastActivityRaw);
        if (idle > thresholdMs) {
            return res.status(401).json({
                error: 'Session expired due to inactivity. Please log in again.',
                code: 'SESSION_IDLE_TIMEOUT',
            });
        }
    } catch { /* if cache/DB is down, fail open so users aren't locked out */ }

    next();
}

// ─── Require Confirmation ─────────────────────────────────────────────────────

/**
 * For routes that perform critical admin actions (e.g. bulk delete, lock accounts).
 * If security.require_confirmation is enabled, the caller must include
 * `X-Admin-Confirm: true` in the request headers.
 *
 * Usage: add as a route-level middleware on admin mutation routes.
 */
async function requireAdminConfirmation(req, res, next) {
    try {
        const enabled = await isSettingEnabled('security', 'require_confirmation', false);
        if (!enabled) return next();

        const confirmed = req.headers['x-admin-confirm'];
        if (confirmed !== 'true') {
            return res.status(428).json({
                error: 'This action requires explicit confirmation. Include X-Admin-Confirm: true in your request.',
                code: 'CONFIRMATION_REQUIRED',
            });
        }
    } catch { /* fail open */ }

    next();
}

// ─── Two-Step Verification ────────────────────────────────────────────────────

const TWO_STEP_TOKEN_PREFIX = 'two_step_token:';
const TWO_STEP_TOKEN_TTL    = 5 * 60; // 5-minute validity window

/**
 * Issue a short-lived two-step token for a user.
 * Called by the admin server once the admin completes their second factor.
 * The token is stored in cache so the main server can validate it.
 *
 * @param {string} userId  The admin's user ID
 * @param {string} token   A secure random token (admin server generates this)
 */
async function issueTwoStepToken(userId, token) {
    await cache.set(`${TWO_STEP_TOKEN_PREFIX}${userId}`, token, TWO_STEP_TOKEN_TTL);
}

/**
 * Enforce two-step verification on admin action routes.
 * If security.two_step_verification is enabled, the caller must include
 * `X-Admin-2Step-Token: <token>` — a token that was issued after the admin
 * completed their second factor on the admin server.
 */
async function requireTwoStepVerification(req, res, next) {
    try {
        const enabled = await isSettingEnabled('security', 'two_step_verification', false);
        if (!enabled) return next();

        const userId = req.user?.sub;
        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
        }

        const providedToken = req.headers['x-admin-2step-token'];
        if (!providedToken) {
            return res.status(428).json({
                error: 'Two-step verification required. Include X-Admin-2Step-Token in your request.',
                code: 'TWO_STEP_REQUIRED',
            });
        }

        const storedToken = await cache.get(`${TWO_STEP_TOKEN_PREFIX}${userId}`);
        if (!storedToken || storedToken !== providedToken) {
            return res.status(403).json({
                error: 'Invalid or expired two-step token.',
                code: 'TWO_STEP_INVALID',
            });
        }

        // Consume the token (one-time use)
        await cache.del(`${TWO_STEP_TOKEN_PREFIX}${userId}`);
    } catch { /* fail open */ }

    next();
}

module.exports = {
    trackUserActivity,
    enforceAutoLogout,
    requireAdminConfirmation,
    requireTwoStepVerification,
    issueTwoStepToken,
};
