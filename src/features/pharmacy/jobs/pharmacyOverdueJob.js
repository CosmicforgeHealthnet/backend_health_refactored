/**
 * Pharmacy Invoice Overdue Job
 *
 * Runs daily. Finds invoices that:
 *  - Have a dueAt in the past
 *  - Are NOT in status: paid, overdue, or cancelled
 *
 * Marks them as "overdue" and triggers a notification to the patient.
 */

const invoiceRepo           = require("../repositories/invoiceRepository");
const NotificationService   = require("../../notifications/services/notificationService");
const pharmacyEmailHelper   = require("../../../shared/services/email/helper/pharmacy");

const notificationService = new NotificationService();

async function runOverdueJob() {
  console.log("[PharmacyOverdue] Starting overdue invoice check...");

  try {
    const overdueInvoices = await invoiceRepo.findOverdue();

    if (overdueInvoices.length === 0) {
      console.log("[PharmacyOverdue] No overdue invoices found.");
      return;
    }

    console.log(`[PharmacyOverdue] Found ${overdueInvoices.length} overdue invoice(s).`);

    for (const invoice of overdueInvoices) {
      try {
        await invoiceRepo.update(invoice.id, { status: "overdue" });

        // Notify patient (push + email)
        try {
          await notificationService.createNotification(invoice.patientId, {
            title:   "Invoice Overdue",
            message: `Your invoice ${invoice.reference} is overdue. Please make payment as soon as possible.`,
            type:    "invoice_overdue",
            data:    { invoiceId: invoice.id },
          });

          // Email — invoice from findOverdue() may include patient relation
          const patientEmail = invoice.patient?.email;
          if (patientEmail) {
            await pharmacyEmailHelper.sendInvoiceOverdueEmail({
              to:          patientEmail,
              patientName: `${invoice.patient.firstName ?? ""} ${invoice.patient.lastName ?? ""}`.trim() || patientEmail,
              pharmacyName: invoice.pharmacy?.pharmacyName ?? "The pharmacy",
              reference:    invoice.reference,
              invoiceId:    invoice.id,
              totalAmount:  parseFloat(invoice.totalAmountUsd),
              currency:     invoice.displayCurrency || "USD",
            });
          }
        } catch (notifErr) {
          console.error(`[PharmacyOverdue] Notification failed for invoice ${invoice.id}:`, notifErr.message);
        }

        console.log(`[PharmacyOverdue] Marked invoice ${invoice.id} (${invoice.reference}) as overdue.`);
      } catch (err) {
        console.error(`[PharmacyOverdue] Failed to process invoice ${invoice.id}:`, err.message);
      }
    }

    console.log("[PharmacyOverdue] Job complete.");
  } catch (err) {
    console.error("[PharmacyOverdue] Job failed:", err.message);
  }
}

module.exports = { runOverdueJob };
