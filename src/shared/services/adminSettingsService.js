// src/shared/services/adminSettingsService.js
//
// Single source of truth for reading admin-configurable settings.
// All services should call getSetting() instead of hardcoding values.
//
// Cache strategy: each key is cached for TTL_MS (default 5 min). Writes
// invalidate the relevant key so the next read picks up the new value.

const AppDataSource = require('../../config/database');

const TTL_MS = 5 * 60 * 1000; // 5 minutes

// { 'category::key': { value, expiresAt } }
const cache = new Map();

function cacheKey(category, key) {
    return `${category}::${key}`;
}

function fromCache(category, key) {
    const entry = cache.get(cacheKey(category, key));
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        cache.delete(cacheKey(category, key));
        return undefined;
    }
    return entry.value;
}

function toCache(category, key, value) {
    cache.set(cacheKey(category, key), { value, expiresAt: Date.now() + TTL_MS });
}

function invalidateCache(category, key) {
    cache.delete(cacheKey(category, key));
}

/**
 * Read a single setting. Returns the parsed JSON value from the `value` column,
 * or `defaultValue` if the row does not exist or the DB is unavailable.
 *
 * @param {string} category  e.g. 'security'
 * @param {string} key       e.g. 'max_login_attempts'
 * @param {*}      defaultValue  Returned when no row exists
 */
async function getSetting(category, key, defaultValue = null) {
    const cached = fromCache(category, key);
    if (cached !== undefined) return cached;

    try {
        const repo = AppDataSource.getRepository('AdminSetting');
        const row = await repo.findOne({ where: { category, key } });
        const value = row ? row.value : defaultValue;
        toCache(category, key, value);
        return value;
    } catch {
        // DB unavailable — fall back to default, do not cache so next call retries
        return defaultValue;
    }
}

/**
 * Convenience wrapper: returns setting.value (the numeric/string payload) if
 * setting.enabled is true, otherwise returns defaultValue.
 *
 * Use for { enabled, value } and { enabled, value, unit } shapes.
 */
async function getSettingValue(category, key, defaultValue = null) {
    const setting = await getSetting(category, key, null);
    if (!setting || setting.enabled === false) return defaultValue;
    return setting.value ?? defaultValue;
}

/**
 * Returns true when the setting exists and setting.enabled === true.
 * Use for { enabled } boolean shapes.
 */
async function isSettingEnabled(category, key, defaultValue = false) {
    const setting = await getSetting(category, key, null);
    if (!setting) return defaultValue;
    return setting.enabled === true;
}

/**
 * Returns true when the given channel (email | sms | inApp) is enabled
 * for the notification section. Falls back to true so notifications are
 * sent by default when no admin setting exists yet.
 *
 * @param {string} section  e.g. 'telemedicine'
 * @param {'email'|'sms'|'inApp'} channel
 */
async function isNotificationChannelEnabled(section, channel) {
    const setting = await getSetting('notification', section, null);
    if (!setting) return true; // default open
    return setting[channel] !== false;
}

/**
 * Persist a new or updated setting and append an audit row.
 *
 * @param {string} category
 * @param {string} key
 * @param {*}      value     The full JSON value to store
 * @param {string} changedBy  UUID of the admin who made the change
 */
async function upsertSetting(category, key, value, changedBy) {
    const settingRepo  = AppDataSource.getRepository('AdminSetting');
    const historyRepo  = AppDataSource.getRepository('AdminSettingHistory');

    let existing = await settingRepo.findOne({ where: { category, key } });
    const oldValue = existing ? existing.value : null;

    if (existing) {
        existing.value     = value;
        existing.updatedBy = changedBy;
        existing.updatedAt = new Date();
        existing = await settingRepo.save(existing);
    } else {
        existing = await settingRepo.save(
            settingRepo.create({ category, key, value, updatedBy: changedBy })
        );
    }

    await historyRepo.save(
        historyRepo.create({
            settingId: existing.id,
            category,
            key,
            oldValue,
            newValue: value,
            changedBy,
        })
    );

    invalidateCache(category, key);
    return existing;
}

module.exports = {
    getSetting,
    getSettingValue,
    isSettingEnabled,
    isNotificationChannelEnabled,
    upsertSetting,
    invalidateCache,
};
