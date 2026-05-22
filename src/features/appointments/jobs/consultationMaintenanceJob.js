// src/features/appointments/jobs/consultationMaintenanceJob.js
//
// Enforces the following admin_settings:
//   behavior.telemedicine.auto_end_inactive    — end chats with no message activity
//   behavior.telemedicine.auto_end_unfinished  — end chats that went past scheduledEndTime
//   behavior.telemedicine.consultation_timeout — (already enforced in appointmentService; here used for cross-check)
//   behavior.telemedicine.followup_rules       — fire follow-up notifications after completion
//   behavior.rtc.session_timeout               — end RTC session after X time from actualStartTime
//   behavior.rtc.auto_end_inactive             — end RTC session if chat room has been idle
//   behavior.rtc.max_session_duration          — hard cap regardless of activity
//   behavior.rtc.reconnect_allowance           — tracked in cache; checked during reconnect (see helper below)

const AppDataSource = require('../../../config/database');
const { getSetting } = require('../../../shared/services/adminSettingsService');
const cache = require('../../../shared/utils/cache');

// ─── Unit helpers ─────────────────────────────────────────────────────────────

function toMs(setting, fallbackMs) {
    if (!setting || setting.enabled === false || !setting.value) return fallbackMs;
    const u = (setting.unit || '').toLowerCase();
    if (u === 'minutes' || u === 'minute') return setting.value * 60 * 1000;
    if (u === 'hours'   || u === 'hour')   return setting.value * 60 * 60 * 1000;
    if (u === 'days'    || u === 'day')     return setting.value * 24 * 60 * 60 * 1000;
    return fallbackMs;
}

// ─── Reconnect allowance helper ────────────────────────────────────────────────

const RECONNECT_PREFIX = 'rtc_disconnected:';

/**
 * Call this when a participant disconnects from an RTC/chat session.
 * Stores the disconnect time in cache so reconnect checks can validate the window.
 */
async function recordDisconnect(chatRoomId, userId) {
    const setting = await getSetting('behavior.rtc', 'reconnect_allowance', { enabled: true, value: 2, unit: 'Minutes' });
    const ttlMs  = toMs(setting, 2 * 60 * 1000);
    const ttlSec = Math.ceil(ttlMs / 1000);
    await cache.set(`${RECONNECT_PREFIX}${chatRoomId}:${userId}`, Date.now().toString(), ttlSec);
}

/**
 * Returns true if the user is still within the reconnect window for a room.
 * Call this when a participant tries to rejoin after a disconnect.
 */
async function isWithinReconnectWindow(chatRoomId, userId) {
    try {
        const raw = await cache.get(`${RECONNECT_PREFIX}${chatRoomId}:${userId}`);
        if (!raw) return false;

        const setting = await getSetting('behavior.rtc', 'reconnect_allowance', { enabled: true, value: 2, unit: 'Minutes' });
        const windowMs = toMs(setting, 2 * 60 * 1000);
        return Date.now() - Number(raw) <= windowMs;
    } catch {
        return true; // fail open — allow reconnect if cache is unavailable
    }
}

// ─── Auto-end inactive chats (telemedicine + RTC) ─────────────────────────────

async function autoEndInactiveChats() {
    // Resolve the more restrictive of telemedicine and RTC inactive settings
    const [teleSetting, rtcSetting] = await Promise.all([
        getSetting('behavior.telemedicine', 'auto_end_inactive', { enabled: true, value: 30, unit: 'Minutes' }),
        getSetting('behavior.rtc',          'auto_end_inactive', { enabled: true, value: 15, unit: 'Minutes' }),
    ]);

    const teleMs = toMs(teleSetting, 30 * 60 * 1000);
    const rtcMs  = toMs(rtcSetting,  15 * 60 * 1000);

    // Use the shorter of the two as the effective threshold
    const teleEnabled = !teleSetting || teleSetting.enabled !== false;
    const rtcEnabled  = !rtcSetting  || rtcSetting.enabled  !== false;

    if (!teleEnabled && !rtcEnabled) return { ended: 0 };

    const thresholdMs = (teleEnabled && rtcEnabled)
        ? Math.min(teleMs, rtcMs)
        : (teleEnabled ? teleMs : rtcMs);

    const cutoff = new Date(Date.now() - thresholdMs);

    // End 'active' appointment_chats whose linked ChatRoom.lastActivityAt < cutoff
    const result = await AppDataSource.query(`
        UPDATE appointment_chats ac
        SET    status        = 'completed',
               "actualEndTime" = NOW(),
               "updatedAt"   = NOW()
        FROM   chat_rooms cr
        WHERE  ac."roomId"          = cr.id
          AND  ac.status            = 'active'
          AND  ac."autoCloseEnabled" = true
          AND  cr."lastActivityAt"  IS NOT NULL
          AND  cr."lastActivityAt"  < $1
        RETURNING ac.id
    `, [cutoff]);

    const ended = Array.isArray(result) ? result.length : (result?.rowCount ?? 0);
    if (ended > 0) {
        console.log(`[ConsultationMaintenance] auto_end_inactive: closed ${ended} inactive chat(s) (threshold: ${Math.round(thresholdMs / 60000)} min)`);
    }
    return { ended };
}

// ─── Auto-end unfinished consultations ────────────────────────────────────────

async function autoEndUnfinishedChats() {
    const setting = await getSetting('behavior.telemedicine', 'auto_end_unfinished', { enabled: true, value: 60, unit: 'Minutes' });
    if (!setting || setting.enabled === false) return { ended: 0 };

    const graceMs = toMs(setting, 60 * 60 * 1000);
    const cutoff  = new Date(Date.now() - graceMs);

    // End 'active' chats whose scheduledEndTime + grace period has passed
    const result = await AppDataSource.query(`
        UPDATE appointment_chats
        SET    status         = 'completed',
               "actualEndTime" = NOW(),
               "updatedAt"    = NOW()
        WHERE  status                            = 'active'
          AND  "autoCloseEnabled"               = true
          AND  "scheduledEndTime" + ($1 || ' milliseconds')::interval < NOW()
        RETURNING id
    `, [graceMs]);

    const ended = Array.isArray(result) ? result.length : (result?.rowCount ?? 0);
    if (ended > 0) {
        console.log(`[ConsultationMaintenance] auto_end_unfinished: closed ${ended} unfinished chat(s)`);
    }
    return { ended };
}

// ─── RTC session timeout (from actualStartTime) ────────────────────────────────

async function enforceRtcSessionTimeout() {
    const setting = await getSetting('behavior.rtc', 'session_timeout', { enabled: true, value: 60, unit: 'Minutes' });
    if (!setting || setting.enabled === false) return { ended: 0 };

    const timeoutMs = toMs(setting, 60 * 60 * 1000);
    const cutoff    = new Date(Date.now() - timeoutMs);

    const result = await AppDataSource.query(`
        UPDATE appointment_chats
        SET    status          = 'completed',
               "actualEndTime" = NOW(),
               "updatedAt"     = NOW()
        WHERE  status             = 'active'
          AND  "actualStartTime"  IS NOT NULL
          AND  "actualStartTime"  < $1
        RETURNING id
    `, [cutoff]);

    const ended = Array.isArray(result) ? result.length : (result?.rowCount ?? 0);
    if (ended > 0) {
        console.log(`[ConsultationMaintenance] rtc.session_timeout: ended ${ended} session(s) exceeding ${Math.round(timeoutMs / 60000)} min`);
    }
    return { ended };
}

// ─── RTC max session duration (hard cap) ──────────────────────────────────────

async function enforceMaxSessionDuration() {
    const setting = await getSetting('behavior.rtc', 'max_session_duration', { enabled: true, value: 120, unit: 'Minutes' });
    if (!setting || setting.enabled === false) return { ended: 0 };

    const maxMs  = toMs(setting, 120 * 60 * 1000);
    const cutoff = new Date(Date.now() - maxMs);

    const result = await AppDataSource.query(`
        UPDATE appointment_chats
        SET    status          = 'completed',
               "actualEndTime" = NOW(),
               "updatedAt"     = NOW()
        WHERE  status             = 'active'
          AND  "actualStartTime"  IS NOT NULL
          AND  "actualStartTime"  < $1
        RETURNING id
    `, [cutoff]);

    const ended = Array.isArray(result) ? result.length : (result?.rowCount ?? 0);
    if (ended > 0) {
        console.log(`[ConsultationMaintenance] rtc.max_session_duration: force-ended ${ended} session(s) exceeding hard cap of ${Math.round(maxMs / 60000)} min`);
    }
    return { ended };
}

// ─── Follow-up rules ──────────────────────────────────────────────────────────

async function enforceFollowupRules() {
    const setting = await getSetting('behavior.telemedicine', 'followup_rules', null);
    if (!setting || setting.enabled === false || !Array.isArray(setting.tags) || setting.tags.length === 0) return { processed: 0 };

    const tags = setting.tags;

    // Find appointments completed in the last 24 hours that haven't had a follow-up sent
    const recentlyCompleted = await AppDataSource.query(`
        SELECT ac.id as chat_id, ac."doctorId", ac."patientId", a.id as appointment_id
        FROM   appointment_chats ac
        JOIN   appointments a ON a.id = ac."appointmentId"
        WHERE  ac.status      = 'completed'
          AND  ac."actualEndTime" >= NOW() - INTERVAL '24 hours'
          AND  (ac.settings->>'followupSent') IS DISTINCT FROM 'true'
        LIMIT  100
    `);

    if (!recentlyCompleted.length) return { processed: 0 };

    for (const row of recentlyCompleted) {
        // Build follow-up notification message based on tags
        let message = 'Your consultation has ended.';
        if (tags.includes('Prompt Doctor Review'))  message += ' The doctor will review your case shortly.';
        if (tags.includes('Send Reminder'))         message += ' You will receive a follow-up reminder.';

        // Fire WebSocket notification to patient
        try {
            const { getIO } = require('../../../config/websocket');
            const io = getIO();
            io.to(`user_${row.patientid}`).emit('consultation_followup', {
                appointmentId: row.appointment_id,
                message,
                tags,
            });
        } catch { /* best-effort */ }

        // Mark as sent in settings jsonb so we don't repeat
        await AppDataSource.query(`
            UPDATE appointment_chats
            SET    settings   = COALESCE(settings, '{}'::jsonb) || '{"followupSent": "true"}'::jsonb,
                   "updatedAt" = NOW()
            WHERE  id = $1
        `, [row.chat_id]);
    }

    console.log(`[ConsultationMaintenance] followup_rules: processed ${recentlyCompleted.length} follow-up(s) with tags: ${tags.join(', ')}`);
    return { processed: recentlyCompleted.length };
}

// ─── Master runner ─────────────────────────────────────────────────────────────

async function runConsultationMaintenance() {
    const results = await Promise.allSettled([
        autoEndInactiveChats(),
        autoEndUnfinishedChats(),
        enforceRtcSessionTimeout(),
        enforceMaxSessionDuration(),
        enforceFollowupRules(),
    ]);

    for (const r of results) {
        if (r.status === 'rejected') {
            console.error('[ConsultationMaintenance] task error:', r.reason?.message);
        }
    }
}

module.exports = {
    runConsultationMaintenance,
    recordDisconnect,
    isWithinReconnectWindow,
};
