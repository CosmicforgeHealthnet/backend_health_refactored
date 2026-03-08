// src/shared/services/email/helper/pharmacy.js
// Pharmacy-specific email helpers (use sendRaw — no Handlebars templates needed)
const emailService = require("../emailService");

const BASE_URL = process.env.APP_BASE_URL || "";
const YEAR = () => new Date().getFullYear();

// ─── Staff Welcome ──────────────────────────────────────────────────────────

/**
 * Notify a newly created pharmacy staff member of their login credentials.
 * @param {Object} p
 * @param {string} p.to - Staff email
 * @param {string} p.staffName
 * @param {string} p.pharmacyName
 * @param {string} p.role - e.g. "pharmacist", "pharmacy_staff"
 * @param {string} p.loginEmail
 * @param {string} p.password - plain-text password set by admin
 */
async function sendPharmacyStaffWelcomeEmail(p) {
  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
  <div style="background:#1a73e8;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Welcome to ${p.pharmacyName}</h1>
    <p style="color:#e8f0fe;margin:6px 0 0;font-size:14px;">CosmicForge Health Platform</p>
  </div>
  <div style="padding:32px 28px;">
    <p style="font-size:16px;color:#333;">Hi <strong>${p.staffName}</strong>,</p>
    <p style="color:#555;line-height:1.6;">
      Your <strong>${p.role.replace(/_/g, " ")}</strong> account has been created at <strong>${p.pharmacyName}</strong> on the CosmicForge Health platform.
      Here are your login credentials:
    </p>
    <div style="background:#f0f4ff;border-left:4px solid #1a73e8;padding:16px 20px;border-radius:4px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#333;"><strong>Login Email:</strong> ${p.loginEmail}</p>
      <p style="margin:0;color:#333;"><strong>Password:</strong> <span style="font-family:monospace;background:#e8eaed;padding:2px 6px;border-radius:3px;">${p.password}</span></p>
    </div>
    <p style="color:#d32f2f;font-size:14px;">⚠️ Please change your password immediately after your first login for security.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${BASE_URL}/pharmacy/login" style="background:#1a73e8;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Login to Dashboard</a>
    </div>
    <p style="color:#777;font-size:13px;">If you have any questions, contact your pharmacy administrator or reach us at <a href="${BASE_URL}/support">support</a>.</p>
  </div>
  <div style="background:#f8f9fa;padding:16px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#999;font-size:12px;margin:0;">© ${YEAR()} CosmicForge Health. All rights reserved.</p>
  </div>
</div>
</body></html>`;
  await emailService.sendRaw(p.to, `Welcome to ${p.pharmacyName} – Your Account Details`, html);
}

// ─── Prescription Assigned to Pharmacy ──────────────────────────────────────

/**
 * Notify pharmacy when a new prescription is assigned to them by a patient.
 * @param {Object} p
 * @param {string} p.to - Pharmacy admin email
 * @param {string} p.pharmacyName
 * @param {string} p.patientName
 * @param {string} p.reference - Prescription reference
 * @param {string} p.prescriptionId
 */
async function sendPrescriptionAssignedToPharmacyEmail(p) {
  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
  <div style="background:#0f9d58;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">New Prescription Request</h1>
    <p style="color:#e6f4ea;margin:6px 0 0;font-size:14px;">CosmicForge Health Platform</p>
  </div>
  <div style="padding:32px 28px;">
    <p style="font-size:16px;color:#333;">Hi <strong>${p.pharmacyName}</strong>,</p>
    <p style="color:#555;line-height:1.6;">
      A new prescription has been assigned to your pharmacy by patient <strong>${p.patientName}</strong>.
    </p>
    <div style="background:#f0faf5;border-left:4px solid #0f9d58;padding:16px 20px;border-radius:4px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#333;"><strong>Reference:</strong> ${p.reference}</p>
      <p style="margin:0;color:#333;"><strong>Patient:</strong> ${p.patientName}</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${BASE_URL}/pharmacy/prescriptions/${p.prescriptionId}" style="background:#0f9d58;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View Prescription</a>
    </div>
  </div>
  <div style="background:#f8f9fa;padding:16px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#999;font-size:12px;margin:0;">© ${YEAR()} CosmicForge Health. All rights reserved.</p>
  </div>
</div>
</body></html>`;
  await emailService.sendRaw(p.to, `New Prescription Request – ${p.reference}`, html);
}

// ─── Availability Confirmed ──────────────────────────────────────────────────

/**
 * Notify patient when pharmacy confirms medication availability.
 * @param {Object} p
 * @param {string} p.to - Patient email
 * @param {string} p.patientName
 * @param {string} p.pharmacyName
 * @param {string} p.reference
 * @param {string} p.prescriptionId
 */
async function sendAvailabilityConfirmedEmail(p) {
  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
  <div style="background:#0f9d58;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Medications Available!</h1>
    <p style="color:#e6f4ea;margin:6px 0 0;font-size:14px;">CosmicForge Health Platform</p>
  </div>
  <div style="padding:32px 28px;">
    <p style="font-size:16px;color:#333;">Hi <strong>${p.patientName}</strong>,</p>
    <p style="color:#555;line-height:1.6;">
      Great news! <strong>${p.pharmacyName}</strong> has confirmed that your prescribed medications are available.
      They will prepare an invoice with pricing details shortly.
    </p>
    <div style="background:#f0faf5;border-left:4px solid #0f9d58;padding:16px 20px;border-radius:4px;margin:20px 0;">
      <p style="margin:0;color:#333;"><strong>Prescription Ref:</strong> ${p.reference}</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${BASE_URL}/patient/prescriptions/${p.prescriptionId}" style="background:#0f9d58;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View Prescription</a>
    </div>
  </div>
  <div style="background:#f8f9fa;padding:16px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#999;font-size:12px;margin:0;">© ${YEAR()} CosmicForge Health. All rights reserved.</p>
  </div>
</div>
</body></html>`;
  await emailService.sendRaw(p.to, `Medications Available – ${p.reference}`, html);
}

// ─── Invoice Ready ───────────────────────────────────────────────────────────

/**
 * Notify patient when pharmacy sends the invoice (costs provided).
 * @param {Object} p
 * @param {string} p.to - Patient email
 * @param {string} p.patientName
 * @param {string} p.pharmacyName
 * @param {string} p.reference
 * @param {string} p.prescriptionId
 * @param {number} p.totalDue
 * @param {number} p.deliveryFee
 * @param {Array}  p.items - [{name, quantity, unitPrice}]
 */
async function sendInvoiceReadyEmail(p) {
  const itemRows = (p.items || []).map(item =>
    `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${item.name}</td>
     <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
     <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">₦${(item.unitPrice || 0).toLocaleString()}</td></tr>`
  ).join("");

  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
  <div style="background:#1a73e8;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Invoice Ready</h1>
    <p style="color:#e8f0fe;margin:6px 0 0;font-size:14px;">CosmicForge Health Platform</p>
  </div>
  <div style="padding:32px 28px;">
    <p style="font-size:16px;color:#333;">Hi <strong>${p.patientName}</strong>,</p>
    <p style="color:#555;line-height:1.6;">
      <strong>${p.pharmacyName}</strong> has prepared your medication invoice. Please review and proceed with payment.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <thead><tr style="background:#f0f4ff;">
        <th style="padding:10px;text-align:left;color:#333;">Medication</th>
        <th style="padding:10px;text-align:center;color:#333;">Qty</th>
        <th style="padding:10px;text-align:right;color:#333;">Price</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="background:#f0f4ff;border-left:4px solid #1a73e8;padding:16px 20px;border-radius:4px;margin:20px 0;">
      <p style="margin:0 0 6px;color:#333;"><strong>Delivery Fee:</strong> ₦${(p.deliveryFee || 0).toLocaleString()}</p>
      <p style="margin:0;color:#1a73e8;font-size:18px;font-weight:bold;"><strong>Total Due: ₦${(p.totalDue || 0).toLocaleString()}</strong></p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${BASE_URL}/patient/prescriptions/${p.prescriptionId}" style="background:#1a73e8;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; Pay Invoice</a>
    </div>
  </div>
  <div style="background:#f8f9fa;padding:16px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#999;font-size:12px;margin:0;">© ${YEAR()} CosmicForge Health. All rights reserved.</p>
  </div>
</div>
</body></html>`;
  await emailService.sendRaw(p.to, `Invoice Ready – ${p.reference} (₦${(p.totalDue || 0).toLocaleString()})`, html);
}

// ─── Prescription Ready ──────────────────────────────────────────────────────

/**
 * Notify patient when prescription is ready for delivery or pickup.
 * @param {Object} p
 * @param {string} p.to - Patient email
 * @param {string} p.patientName
 * @param {string} p.pharmacyName
 * @param {string} p.reference
 * @param {string} p.prescriptionId
 * @param {string} p.readyType - "delivery" | "pickup"
 * @param {string} [p.expectedDate]
 */
async function sendPrescriptionReadyEmail(p) {
  const isDelivery = p.readyType === "delivery";
  const actionText = isDelivery ? "Your medications are on their way!" : "Your medications are ready for pickup.";
  const subTitle = isDelivery ? "Out for Delivery" : "Ready for Pickup";

  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
  <div style="background:#f57c00;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">${subTitle}</h1>
    <p style="color:#fff3e0;margin:6px 0 0;font-size:14px;">CosmicForge Health Platform</p>
  </div>
  <div style="padding:32px 28px;">
    <p style="font-size:16px;color:#333;">Hi <strong>${p.patientName}</strong>,</p>
    <p style="color:#555;line-height:1.6;">${actionText}</p>
    <div style="background:#fff8f0;border-left:4px solid #f57c00;padding:16px 20px;border-radius:4px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#333;"><strong>Prescription Ref:</strong> ${p.reference}</p>
      <p style="margin:0 0 8px;color:#333;"><strong>Pharmacy:</strong> ${p.pharmacyName}</p>
      ${p.expectedDate ? `<p style="margin:0;color:#333;"><strong>Expected Date:</strong> ${new Date(p.expectedDate).toLocaleDateString()}</p>` : ""}
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${BASE_URL}/patient/prescriptions/${p.prescriptionId}" style="background:#f57c00;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Track Order</a>
    </div>
  </div>
  <div style="background:#f8f9fa;padding:16px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#999;font-size:12px;margin:0;">© ${YEAR()} CosmicForge Health. All rights reserved.</p>
  </div>
</div>
</body></html>`;
  await emailService.sendRaw(p.to, `${subTitle} – ${p.reference}`, html);
}

// ─── Alternative Suggested ───────────────────────────────────────────────────

/**
 * Notify patient when pharmacy proposes alternative medications.
 * @param {Object} p
 * @param {string} p.to - Patient email
 * @param {string} p.patientName
 * @param {string} p.pharmacyName
 * @param {string} p.reference
 * @param {string} p.prescriptionId
 * @param {Array}  p.alternatives - [{name, dosage, reason}]
 */
async function sendAlternativeSuggestedEmail(p) {
  const altRows = (p.alternatives || []).map(alt =>
    `<li style="margin-bottom:10px;color:#555;">
      <strong>${alt.name}</strong>${alt.dosage ? ` (${alt.dosage})` : ""}
      ${alt.reason ? `<br><span style="font-size:13px;color:#777;">Reason: ${alt.reason}</span>` : ""}
    </li>`
  ).join("");

  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
  <div style="background:#7b1fa2;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Alternative Medications Suggested</h1>
    <p style="color:#f3e5f5;margin:6px 0 0;font-size:14px;">CosmicForge Health Platform</p>
  </div>
  <div style="padding:32px 28px;">
    <p style="font-size:16px;color:#333;">Hi <strong>${p.patientName}</strong>,</p>
    <p style="color:#555;line-height:1.6;">
      <strong>${p.pharmacyName}</strong> has suggested alternative medications for your prescription <strong>${p.reference}</strong>.
      Some of your original medications may be unavailable or have better alternatives.
    </p>
    <div style="background:#f9f0ff;border-left:4px solid #7b1fa2;padding:16px 20px;border-radius:4px;margin:20px 0;">
      <p style="margin:0 0 10px;color:#333;font-weight:bold;">Suggested Alternatives:</p>
      <ul style="margin:0;padding-left:20px;">${altRows}</ul>
    </div>
    <p style="color:#555;font-size:14px;">Please review the suggestions and contact the pharmacy if you have questions.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${BASE_URL}/patient/prescriptions/${p.prescriptionId}" style="background:#7b1fa2;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Review Alternatives</a>
    </div>
  </div>
  <div style="background:#f8f9fa;padding:16px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#999;font-size:12px;margin:0;">© ${YEAR()} CosmicForge Health. All rights reserved.</p>
  </div>
</div>
</body></html>`;
  await emailService.sendRaw(p.to, `Alternative Medications Suggested – ${p.reference}`, html);
}

// ─── Prescription Cancelled ──────────────────────────────────────────────────

/**
 * Notify a user when a prescription is cancelled.
 * @param {Object} p
 * @param {string} p.to
 * @param {string} p.recipientName
 * @param {string} p.reference
 * @param {string} p.prescriptionId
 * @param {string} p.cancelledBy - "patient" | "doctor" | "pharmacy"
 * @param {string} p.reason
 */
async function sendPrescriptionCancelledEmail(p) {
  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
  <div style="background:#c62828;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Prescription Cancelled</h1>
    <p style="color:#ffcdd2;margin:6px 0 0;font-size:14px;">CosmicForge Health Platform</p>
  </div>
  <div style="padding:32px 28px;">
    <p style="font-size:16px;color:#333;">Hi <strong>${p.recipientName}</strong>,</p>
    <p style="color:#555;line-height:1.6;">
      Prescription <strong>${p.reference}</strong> has been cancelled by the <strong>${p.cancelledBy}</strong>.
    </p>
    ${p.reason ? `<div style="background:#fff5f5;border-left:4px solid #c62828;padding:16px 20px;border-radius:4px;margin:20px 0;">
      <p style="margin:0;color:#333;"><strong>Reason:</strong> ${p.reason}</p>
    </div>` : ""}
    <div style="text-align:center;margin:28px 0;">
      <a href="${BASE_URL}/patient/prescriptions" style="background:#c62828;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View My Prescriptions</a>
    </div>
  </div>
  <div style="background:#f8f9fa;padding:16px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#999;font-size:12px;margin:0;">© ${YEAR()} CosmicForge Health. All rights reserved.</p>
  </div>
</div>
</body></html>`;
  await emailService.sendRaw(p.to, `Prescription Cancelled – ${p.reference}`, html);
}

// ─── Prescription Completed ──────────────────────────────────────────────────

/**
 * Notify patient when prescription has been completed/fulfilled.
 * @param {Object} p
 * @param {string} p.to - Patient email
 * @param {string} p.patientName
 * @param {string} p.pharmacyName
 * @param {string} p.reference
 * @param {string} p.prescriptionId
 */
async function sendPrescriptionCompletedEmail(p) {
  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
  <div style="background:#0f9d58;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Prescription Fulfilled!</h1>
    <p style="color:#e6f4ea;margin:6px 0 0;font-size:14px;">CosmicForge Health Platform</p>
  </div>
  <div style="padding:32px 28px;">
    <p style="font-size:16px;color:#333;">Hi <strong>${p.patientName}</strong>,</p>
    <p style="color:#555;line-height:1.6;">
      Your prescription <strong>${p.reference}</strong> has been successfully fulfilled by <strong>${p.pharmacyName}</strong>.
      We hope you feel better soon!
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${BASE_URL}/patient/prescriptions/${p.prescriptionId}" style="background:#0f9d58;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View Details</a>
    </div>
  </div>
  <div style="background:#f8f9fa;padding:16px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#999;font-size:12px;margin:0;">© ${YEAR()} CosmicForge Health. All rights reserved.</p>
  </div>
</div>
</body></html>`;
  await emailService.sendRaw(p.to, `Prescription Fulfilled – ${p.reference}`, html);
}

module.exports = {
  sendPharmacyStaffWelcomeEmail,
  sendPrescriptionAssignedToPharmacyEmail,
  sendAvailabilityConfirmedEmail,
  sendInvoiceReadyEmail,
  sendPrescriptionReadyEmail,
  sendAlternativeSuggestedEmail,
  sendPrescriptionCancelledEmail,
  sendPrescriptionCompletedEmail,
};
