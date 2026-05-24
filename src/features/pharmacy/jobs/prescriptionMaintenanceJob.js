// src/features/pharmacy/jobs/prescriptionMaintenanceJob.js
//
// Enforces the following admin_settings:
//   behavior.telemedicine.prescription_expiry          — cancel stale/unfulfilled prescriptions
//   behavior.logistics.auto_driver_assignment_delay    — auto-advance READY_FOR_PICKUP after delay
//   behavior.logistics.reassignment_trigger_time       — flag OUT_FOR_DELIVERY prescriptions stuck too long
//   behavior.logistics.delivery_timeout_rules          — cancel deliveries that hit the hard timeout
//   behavior.logistics.retry_delivery_attempts         — cap how many delivery retries are allowed

const AppDataSource = require('../../../config/database');
const { getSetting } = require('../../../shared/services/adminSettingsService');

function toMs(setting, fallbackMs) {
    if (!setting || setting.enabled === false || !setting.value) return fallbackMs;
    const u = (setting.unit || '').toLowerCase();
    if (u === 'minutes' || u === 'minute') return setting.value * 60 * 1000;
    if (u === 'hours'   || u === 'hour')   return setting.value * 60 * 60 * 1000;
    if (u === 'days'    || u === 'day')     return setting.value * 24 * 60 * 60 * 1000;
    return fallbackMs;
}

// ─── Prescription expiry ──────────────────────────────────────────────────────

async function expireOldPrescriptions() {
    const setting = await getSetting('behavior.telemedicine', 'prescription_expiry', { enabled: true, value: 30, unit: 'Days' });
    if (!setting || setting.enabled === false) return { expired: 0 };

    const expiryMs = toMs(setting, 30 * 24 * 60 * 60 * 1000);
    const cutoff   = new Date(Date.now() - expiryMs);

    // Cancel prescriptions that are still in early stages and older than the expiry window.
    // We do NOT cancel prescriptions already in transit (OUT_FOR_DELIVERY) or COMPLETED/CANCELLED.
    const result = await AppDataSource.query(`
        UPDATE prescriptions
        SET    status      = 'cancelled',
               "updatedAt" = NOW()
        WHERE  status IN ('pending', 'patient_uploaded', 'pharmacy_assigned', 'pharmacy_processing', 'under_review')
          AND  "createdAt" < $1
        RETURNING id, reference
    `, [cutoff]);

    const expired = Array.isArray(result) ? result.length : (result?.rowCount ?? 0);
    if (expired > 0) {
        console.log(`[PrescriptionMaintenance] prescription_expiry: expired ${expired} stale prescription(s) older than ${Math.round(expiryMs / 86400000)} day(s)`);
    }
    return { expired };
}

// ─── Auto driver assignment delay ─────────────────────────────────────────────
// Since there is no separate driver model, this auto-advances prescriptions from
// READY_FOR_PICKUP → OUT_FOR_DELIVERY after the configured delay, simulating
// automatic dispatch when no manual driver assignment has occurred.

async function autoAdvanceReadyForPickup() {
    const setting = await getSetting('behavior.logistics', 'auto_driver_assignment_delay', { enabled: true, value: 30, unit: 'Minutes' });
    if (!setting || setting.enabled === false) return { advanced: 0 };

    const delayMs = toMs(setting, 30 * 60 * 1000);
    const cutoff  = new Date(Date.now() - delayMs);

    const result = await AppDataSource.query(`
        UPDATE prescriptions
        SET    status        = 'out_for_delivery',
               "dispatchedAt" = NOW(),
               "updatedAt"   = NOW()
        WHERE  status         = 'ready_for_pickup'
          AND  "updatedAt"   < $1
        RETURNING id, reference
    `, [cutoff]);

    const advanced = Array.isArray(result) ? result.length : (result?.rowCount ?? 0);
    if (advanced > 0) {
        console.log(`[PrescriptionMaintenance] auto_driver_assignment_delay: auto-dispatched ${advanced} prescription(s)`);
    }
    return { advanced };
}

// ─── Reassignment trigger ─────────────────────────────────────────────────────
// Flag prescriptions in OUT_FOR_DELIVERY that have been there too long without completion.
// We mark them back to READY_FOR_PICKUP so they can be reassigned.

async function triggerDeliveryReassignment() {
    const [reassignSetting, retrySetting] = await Promise.all([
        getSetting('behavior.logistics', 'reassignment_trigger_time', { enabled: true, value: 2,  unit: 'Hours' }),
        getSetting('behavior.logistics', 'retry_delivery_attempts',   { enabled: true, value: 3 }),
    ]);

    if (!reassignSetting || reassignSetting.enabled === false) return { reassigned: 0 };

    const triggerMs = toMs(reassignSetting, 2 * 60 * 60 * 1000);
    const maxRetries = (retrySetting?.enabled !== false && retrySetting?.value) ? retrySetting.value : 3;
    const cutoff     = new Date(Date.now() - triggerMs);

    // Reset to ready_for_pickup if dispatchedAt is older than trigger time and retries < max
    const result = await AppDataSource.query(`
        UPDATE prescriptions
        SET    status                            = 'ready_for_pickup',
               "dispatchedAt"                  = NULL,
               metadata                         = COALESCE(metadata::jsonb, '{}'::jsonb)
                                                   || jsonb_build_object(
                                                        'deliveryRetries',
                                                        COALESCE((metadata::jsonb->>'deliveryRetries')::int, 0) + 1
                                                      ),
               "updatedAt"                      = NOW()
        WHERE  status            = 'out_for_delivery'
          AND  "dispatchedAt"   IS NOT NULL
          AND  "dispatchedAt"   < $1
          AND  COALESCE((metadata::jsonb->>'deliveryRetries')::int, 0) < $2
        RETURNING id, reference
    `, [cutoff, maxRetries]);

    const reassigned = Array.isArray(result) ? result.length : (result?.rowCount ?? 0);
    if (reassigned > 0) {
        console.log(`[PrescriptionMaintenance] reassignment_trigger_time: flagged ${reassigned} prescription(s) for reassignment`);
    }
    return { reassigned };
}

// ─── Delivery timeout ─────────────────────────────────────────────────────────
// Cancel deliveries that have exhausted retries and exceeded the hard timeout.

async function enforceDeliveryTimeout() {
    const [timeoutSetting, retrySetting] = await Promise.all([
        getSetting('behavior.logistics', 'delivery_timeout_rules', { enabled: true, value: 48, unit: 'Hours' }),
        getSetting('behavior.logistics', 'retry_delivery_attempts', { enabled: true, value: 3 }),
    ]);

    if (!timeoutSetting || timeoutSetting.enabled === false) return { cancelled: 0 };

    const timeoutMs  = toMs(timeoutSetting, 48 * 60 * 60 * 1000);
    const maxRetries = (retrySetting?.enabled !== false && retrySetting?.value) ? retrySetting.value : 3;
    const cutoff     = new Date(Date.now() - timeoutMs);

    // Cancel prescriptions that: have exhausted retries AND were dispatched before the timeout cutoff
    const result = await AppDataSource.query(`
        UPDATE prescriptions
        SET    status      = 'cancelled',
               "updatedAt" = NOW()
        WHERE  status                IN ('out_for_delivery', 'ready_for_pickup')
          AND  "createdAt"           < $1
          AND  COALESCE((metadata::jsonb->>'deliveryRetries')::int, 0) >= $2
        RETURNING id, reference
    `, [cutoff, maxRetries]);

    const cancelled = Array.isArray(result) ? result.length : (result?.rowCount ?? 0);
    if (cancelled > 0) {
        console.log(`[PrescriptionMaintenance] delivery_timeout_rules: cancelled ${cancelled} timed-out prescription(s)`);
    }
    return { cancelled };
}

// ─── Master runner ────────────────────────────────────────────────────────────

async function runPrescriptionMaintenance() {
    const results = await Promise.allSettled([
        expireOldPrescriptions(),
        autoAdvanceReadyForPickup(),
        triggerDeliveryReassignment(),
        enforceDeliveryTimeout(),
    ]);

    for (const r of results) {
        if (r.status === 'rejected') {
            console.error('[PrescriptionMaintenance] task error:', r.reason?.message);
        }
    }
}

module.exports = { runPrescriptionMaintenance };
