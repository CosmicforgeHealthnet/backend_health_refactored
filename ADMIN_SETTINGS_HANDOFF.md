# Admin Settings — Main Server Handoff

**Date:** 22 May 2026  
**For:** Admin Server Developer  
**Status:** Migrations run on both `cosmicforge_test` (dev) and `cosmicforge_backup1` (live)

---

## Overview

The main server now reads every configurable value from an `admin_settings` table instead of hardcoded constants. When the admin server writes a setting, it takes effect on the main server within **5 minutes** (cache TTL) — no restart needed.

There are two new tables, a shared service, new middleware, and new cron jobs. This document tells you everything you need to write settings from the admin server and understand what each key controls.

---

## Part 1 — Database Tables

### `admin_settings`

Stores one row per setting. The `value` column is always JSON.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `category` | varchar(100) | e.g. `security`, `notification`, `limits` |
| `key` | varchar(200) | e.g. `max_login_attempts` |
| `value` | json | Always a JSON object — see shapes below |
| `updatedBy` | uuid (nullable) | FK → users.id — the admin who last changed it |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Unique constraint:** `(category, key)` — one row per setting.

### `admin_settings_history`

Append-only audit trail. A row is written every time any setting changes.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `settingId` | uuid | FK → admin_settings.id (CASCADE delete) |
| `category` | varchar(100) | Copied from the setting row |
| `key` | varchar(200) | Copied from the setting row |
| `oldValue` | json (nullable) | Value before the change |
| `newValue` | json | Value after the change |
| `changedBy` | uuid | FK → users.id — required |
| `changedAt` | timestamp | |

---

## Part 2 — How to Write Settings from the Admin Server

Use the `upsertSetting` function from the shared service. It handles INSERT vs UPDATE and writes the history row automatically.

```js
const { upsertSetting } = require('./shared/services/adminSettingsService');

// Example: set max login attempts to 3
await upsertSetting('security', 'max_login_attempts', { enabled: true, value: 3 }, adminUserId);

// Example: disable SMS for telemedicine notifications
await upsertSetting('notification', 'telemedicine', { email: true, sms: false, inApp: true }, adminUserId);
```

Or write directly via SQL if you prefer:

```sql
INSERT INTO admin_settings (category, key, value, "updatedBy")
VALUES ('security', 'max_login_attempts', '{"enabled": true, "value": 3}', '<admin-user-id>')
ON CONFLICT (category, key)
DO UPDATE SET value = EXCLUDED.value, "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = NOW();
```

---

## Part 3 — Value Shapes

All values are stored as JSON. There are 5 shapes used across all settings:

### Channel toggle group — `{ email, sms, inApp }`
```json
{ "email": true, "sms": true, "inApp": false }
```

### Numeric + unit — `{ enabled, value, unit }`
Units: `"Minutes"`, `"Hours"`, `"Days"`
```json
{ "enabled": true, "value": 60, "unit": "Minutes" }
```

### Plain number — `{ enabled, value }`
```json
{ "enabled": true, "value": 10 }
```

### Tag list — `{ enabled, tags[] }`
```json
{ "enabled": true, "tags": ["Prompt Doctor Review", "Send Reminder"] }
```

### Single boolean — `{ enabled }`
```json
{ "enabled": true }
```

### Plain string
Used only for localization settings — store the raw string value:
```json
"NGN"
```

---

## Part 4 — All Settings Reference

### Security (`category = "security"`)

| Key | Shape | What it controls on the main server |
|---|---|---|
| `max_login_attempts` | `{ enabled, value }` | Max consecutive failed logins before account locks |
| `lock_duration` | `{ enabled, value, unit }` | How long account stays locked after hitting the limit |
| `session_expiry` | `{ enabled, value, unit }` | Refresh token lifetime (how long a session lasts) |
| `token_expiry` | `{ enabled, value, unit }` | Access token `expiresIn` duration |
| `auto_logout` | `{ enabled, value, unit }` | Inactivity timeout — idle users get a 401 after this |
| `require_confirmation` | `{ enabled }` | If true, admin mutation routes require `X-Admin-Confirm: true` header |
| `two_step_verification` | `{ enabled }` | If true, admin mutation routes require `X-Admin-2Step-Token` header |

### Notification (`category = "notification"`)

Each key controls channel toggles for that event group. All use `{ email, sms, inApp }`.

| Key | Event group |
|---|---|
| `user_account` | User account events |
| `global_system` | Global system events |
| `new_user_registration` | New registrations |
| `telemedicine` | All telemedicine events |
| `consultations` | Consultation events |
| `logistics_orders` | Logistics order events |
| `logistics_all` | All logistics activity |
| `payments` | Payment events |
| `payment_failed` | Failed payment events |
| `lab_tests` | Lab/test events |
| `prescriptions` | Prescription events |
| `system_maintenance` | Maintenance events |
| `security_alerts` | Security alert events |
| `payment_gateway` | Single toggle: `{ enabled }` |

### Behavior — Telemedicine (`category = "behavior.telemedicine"`)

| Key | Shape | What it controls |
|---|---|---|
| `consultation_timeout` | `{ enabled, value, unit }` | Pending-appointment lock window (currently 10 min hardcoded) |
| `auto_end_inactive` | `{ enabled, value, unit }` | Auto-close consultation chats with no message activity |
| `auto_end_unfinished` | `{ enabled, value, unit }` | Auto-close chats that go past their scheduled end time |
| `prescription_expiry` | `{ enabled, value, unit }` | Auto-cancel stale prescriptions in early statuses |
| `followup_rules` | `{ enabled, tags[] }` | Follow-up notifications sent after consultations complete |

### Behavior — RTC (`category = "behavior.rtc"`)

| Key | Shape | What it controls |
|---|---|---|
| `session_timeout` | `{ enabled, value, unit }` | End sessions after this time from `actualStartTime` |
| `auto_end_inactive` | `{ enabled, value, unit }` | End sessions with no chat activity within this window |
| `reconnect_allowance` | `{ enabled, value, unit }` | Window after disconnect where participant can rejoin |
| `max_session_duration` | `{ enabled, value, unit }` | Hard cap — force-end any session exceeding this |

### Behavior — Logistics (`category = "behavior.logistics"`)

| Key | Shape | What it controls |
|---|---|---|
| `auto_driver_assignment_delay` | `{ enabled, value, unit }` | Auto-advance READY_FOR_PICKUP → OUT_FOR_DELIVERY after this delay |
| `reassignment_trigger_time` | `{ enabled, value, unit }` | Reset to READY_FOR_PICKUP if stuck in OUT_FOR_DELIVERY too long |
| `delivery_timeout_rules` | `{ enabled, value, unit }` | Cancel deliveries that hit the hard timeout with exhausted retries |
| `retry_delivery_attempts` | `{ enabled, value }` | Max delivery retry attempts before cancellation |

### System Limits (`category = "limits"`)

| Key | Shape | What it controls |
|---|---|---|
| `max_rtc_sessions_per_doctor` | `{ enabled, value }` | Block new appointments if doctor has this many active chats |
| `max_consultations_per_day` | `{ enabled, value }` | Block new appointments if platform daily total is hit |
| `max_delivery_assignments_per_driver` | `{ enabled, value }` | Block driver assignment if they already have this many active deliveries |
| `max_file_upload_size` | `{ enabled, value }` | Max upload size in **MB** |
| `log_retention_days` | `{ enabled, value }` | Purge audit logs older than this many days (runs daily at 03:30) |
| `api_retry_limit` | `{ enabled, value }` | Max API retry attempts before failing |
| `event_retry_attempts` | `{ enabled, value }` | Max retries for background jobs before dead-letter |
| `timeout_threshold` | `{ enabled, value }` | Axios timeout in **milliseconds** for all external API calls |

### Localization (`category = "localization"`)

| Key | Shape | What it controls |
|---|---|---|
| `default_currency` | plain string e.g. `"NGN"` | Platform-wide currency fallback when no user/country default applies |
| `default_language` | plain string e.g. `"en"` | Default language for notifications and UI text |
| `default_timezone` | plain string e.g. `"Africa/Lagos"` | IANA timezone fallback for scheduling and display |

---

## Part 5 — New Security Middleware (Wire These Up)

Three new middleware functions are exported from:
```
src/features/auth/middlewares/securitySettingsMiddleware.js
```

### `trackUserActivity` + `enforceAutoLogout`

Add these to your **app-level middleware** (after `authenticateJWT`):

```js
const { trackUserActivity, enforceAutoLogout } = require('./features/auth/middlewares/securitySettingsMiddleware');

app.use(authenticateJWT);
app.use(trackUserActivity);   // records last activity timestamp per user
app.use(enforceAutoLogout);   // rejects with 401 if user has been idle too long
```

### `requireAdminConfirmation`

Add as **route-level middleware** on critical admin mutation routes (bulk deletes, account locks, etc.):

```js
const { requireAdminConfirmation } = require('./features/auth/middlewares/securitySettingsMiddleware');

router.delete('/users/bulk', requireAdminConfirmation, bulkDeleteController);
```

When enabled, the caller must include `X-Admin-Confirm: true` in their request headers.

### `requireTwoStepVerification`

Add as **route-level middleware** on all admin action routes:

```js
const { requireTwoStepVerification } = require('./features/auth/middlewares/securitySettingsMiddleware');

router.post('/admin/action', requireTwoStepVerification, actionController);
```

When enabled, caller must include `X-Admin-2Step-Token: <token>`. The admin server issues this token by calling:

```js
const { issueTwoStepToken } = require('./features/auth/middlewares/securitySettingsMiddleware');

// Call this after the admin completes their second factor
await issueTwoStepToken(adminUserId, secureRandomToken);
// Then send `secureRandomToken` to the admin client — it has a 5-minute validity window
```

---

## Part 6 — New Driver Assignment Endpoint

A new `assignDriver` method is available on `PrescriptionService`:

```js
await prescriptionService.assignDriver(prescriptionId, driverId);
```

This checks `limits.max_delivery_assignments_per_driver` before assigning. If the driver already has too many active deliveries it throws a `429` error. Wire this into whatever route you use for driver assignment on the admin/pharmacy side.

---

## Part 7 — Cron Jobs Added

These run automatically — no action needed. Listed here for visibility:

| Job | Schedule | Settings it enforces |
|---|---|---|
| `consultation-maintenance` | Every 5 min | All `behavior.telemedicine.*` and `behavior.rtc.*` |
| `prescription-maintenance` | Every 15 min | `prescription_expiry`, all `behavior.logistics.*` |
| `audit-log-retention-purge` | Daily 03:30 | `limits.log_retention_days` |

---

## Part 8 — Quick Reference: Reading a Setting

The main server uses this pattern everywhere internally. The admin server can use it too if needed:

```js
const { getSetting } = require('./shared/services/adminSettingsService');

const setting = await getSetting('security', 'max_login_attempts', { enabled: true, value: 5 });
// setting = { enabled: true, value: 5 }  ← from DB or fallback default
```

Cache TTL is **5 minutes**. Settings take effect on the next request after the cache expires — no restart needed.

---

## Part 9 — Migration Summary

Three migrations were run on both `cosmicforge_test` and `cosmicforge_backup1`:

| Migration | What it did |
|---|---|
| `1900000000035-CreateAdminSettings` | Created `admin_settings` and `admin_settings_history` tables |
| `1900000000036-AddLoginAttemptColumnsToUsers` | Added `loginAttempts` (int) and `lockedUntil` (timestamp) to `users` |
| `1900000000037-AddDriverIdToPrescriptions` | Added `driverId` (uuid FK → users) to `prescriptions` |
