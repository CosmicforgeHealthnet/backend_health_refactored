// src/shared/services/localizationService.js
//
// Provides platform-wide defaults for currency, language, and timezone.
// All services that need a fallback value (when no user preference is set)
// should call these functions instead of hardcoding 'USD', 'en', or 'UTC'.
//
// Values are read from admin_settings (localization.* keys) with sensible
// built-in defaults so the platform works before an admin has configured them.

const { getSetting } = require('./adminSettingsService');

const BUILT_IN_DEFAULTS = {
    currency: 'USD',
    language: 'en',
    timezone: 'UTC',
};

/**
 * Get the platform default currency code (e.g. 'NGN', 'USD').
 * Used as a last-resort fallback when no user/country currency is available.
 */
async function getDefaultCurrency() {
    const value = await getSetting('localization', 'default_currency', null);
    return (typeof value === 'string' && value.trim()) ? value.trim().toUpperCase() : BUILT_IN_DEFAULTS.currency;
}

/**
 * Get the platform default language code (e.g. 'en', 'fr').
 * Used for notification templates and UI text when no user language is set.
 */
async function getDefaultLanguage() {
    const value = await getSetting('localization', 'default_language', null);
    return (typeof value === 'string' && value.trim()) ? value.trim().toLowerCase() : BUILT_IN_DEFAULTS.language;
}

/**
 * Get the platform default IANA timezone (e.g. 'Africa/Lagos', 'UTC').
 * Used for scheduling and display when no user/request timezone is detected.
 */
async function getDefaultTimezone() {
    const value = await getSetting('localization', 'default_timezone', null);
    return (typeof value === 'string' && value.trim()) ? value.trim() : BUILT_IN_DEFAULTS.timezone;
}

module.exports = { getDefaultCurrency, getDefaultLanguage, getDefaultTimezone };
