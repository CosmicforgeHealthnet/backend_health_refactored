const { AppDataSource } = require("../../../config/database");

const invoiceRepo           = require("../repositories/invoiceRepository");
const pharmacyWalletRepo    = require("../repositories/pharmacyWalletRepository");
const walletTxnRepo         = require("../repositories/pharmacyWalletTransactionRepository");
const prescriptionRepo      = require("../repositories/prescriptionRepository");
const pharmacyProfileRepo   = require("../repositories/pharmacyProfileRepository");
const userRepo              = require("../../auth/repositories/userRepository");

const InvoiceSchema         = require("../entities/Invoice");
const WalletTransactionSchema = require("../entities/PharmacyWalletTransaction");
const { PrescriptionStatus } = require("../entities/Prescription");

const CurrencyService       = require("../../payments/services/currencyService");
const NotificationService   = require("../../notifications/services/notificationService");
const pharmacyEmailHelper   = require("../../../shared/services/email/helper/pharmacy");

const notificationService = new NotificationService();

const { InvoiceStatus, InvoicePaymentMethod } = InvoiceSchema;
const {
  WalletTransactionType,
  WalletTransactionStatus,
  WalletTransactionCategory,
} = WalletTransactionSchema;

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Convert a local-currency amount to USD.
 * Returns { amountUsd, rate }.
 */
async function toUsd(amount, currency) {
  if (currency === "USD") return { amountUsd: amount, rate: 1 };

  const rates = await CurrencyService.getExchangeRates();
  const rate  = rates[currency];

  if (!rate) {
    // Unknown currency → treat as USD
    return { amountUsd: amount, rate: 1 };
  }

  return { amountUsd: Math.round((amount / rate) * 10000) / 10000, rate };
}

/**
 * Convert a USD amount to a display currency.
 */
async function fromUsd(amountUsd, currency) {
  if (currency === "USD") return { amount: amountUsd, rate: 1 };

  const rates = await CurrencyService.getExchangeRates();
  const rate  = rates[currency] || 1;

  return {
    amount: Math.round(amountUsd * rate * 100) / 100,
    rate,
  };
}

/**
 * Format an invoice for API response.
 * Converts stored USD amounts back to the pharmacy/patient display currency.
 */
async function formatInvoice(invoice, displayCurrency, includePharmacyInfo = false) {
  const rate          = (await CurrencyService.getExchangeRates())[displayCurrency] || 1;
  const toDisplay     = (usd) => Math.round(parseFloat(usd) * rate * 100) / 100;

  const lineItems = (invoice.lineItems || []).map((li) => ({
    id:             li.id,
    medicationName: li.medicationName,
    dosage:         li.dosage,
    quantity:       li.quantity,
    unitPrice:      toDisplay(li.unitPriceUsd),
    subtotal:       toDisplay(li.subtotalUsd),
  }));

  const result = {
    id:              invoice.id,
    reference:       invoice.reference,
    prescriptionId:  invoice.prescriptionId,
    prescriptionRef: invoice.prescription?.reference ?? null,
    pharmacyId:      invoice.pharmacyId,
    patientId:       invoice.patientId,
    patientName:     invoice.patient
      ? `${invoice.patient.firstName ?? ""} ${invoice.patient.lastName ?? ""}`.trim()
      : null,
    patientEmail:    invoice.patient?.email ?? null,
    lineItems,
    subtotal:        toDisplay(invoice.subtotalUsd),
    deliveryFee:     toDisplay(invoice.deliveryFeeUsd),
    totalAmount:     toDisplay(invoice.totalAmountUsd),
    currency:        displayCurrency,
    paymentMethod:   invoice.paymentMethod,
    status:          invoice.status,
    paidAt:          invoice.paidAt,
    dueAt:           invoice.dueAt,
    notes:           invoice.notes,
    createdAt:       invoice.createdAt,
    updatedAt:       invoice.updatedAt,
  };

  if (includePharmacyInfo && invoice.pharmacy) {
    result.pharmacyName    = invoice.pharmacy.pharmacyName;
    result.pharmacyAddress = invoice.pharmacy.address;
    result.pharmacyPhone   = invoice.pharmacy.phone;
  }

  return result;
}

// ─── service ────────────────────────────────────────────────────────────────

const invoiceService = {
  /**
   * Create a draft invoice for a prescription.
   * Amounts are submitted in the pharmacy's local currency.
   */
  async createInvoice(pharmacyId, body) {
    const {
      prescriptionId,
      lineItems,
      deliveryFee = 0,
      paymentMethod,
      notes,
      dueAt,
    } = body;

    if (!lineItems || lineItems.length === 0) {
      throw Object.assign(new Error("At least one line item is required"), { status: 400 });
    }

    // Verify prescription belongs to this pharmacy
    const prescription = await prescriptionRepo.findById(prescriptionId);
    if (!prescription) {
      throw Object.assign(new Error("Prescription not found"), { status: 404 });
    }
    if (prescription.pharmacyId !== pharmacyId) {
      throw Object.assign(new Error("Prescription does not belong to this pharmacy"), { status: 403 });
    }

    // Block duplicate invoices — only one active (draft or sent) invoice per prescription
    const { invoices: existing } = await invoiceRepo.findByPharmacy({ pharmacyId, prescriptionId, page: 1, limit: 10 });
    const activeInvoice = existing.find(inv => ["draft", "sent", "viewed", "awaiting_payment"].includes(inv.status));
    if (activeInvoice) {
      throw Object.assign(
        new Error(`An active invoice (${activeInvoice.reference}) already exists for this prescription. Cancel it before creating a new one.`),
        { status: 409 }
      );
    }

    // Get pharmacy profile for display currency
    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);
    const displayCurrency = pharmacy.defaultCurrency || "NGN";

    // Convert amounts to USD
    const { rate } = await toUsd(1, displayCurrency);

    let subtotalUsd = 0;
    const itemsData = lineItems.map((li) => {
      if (!li.medicationName || !li.quantity || !li.unitPrice) {
        throw Object.assign(
          new Error("Each line item must have medicationName, quantity, and unitPrice"),
          { status: 400 }
        );
      }
      if (li.quantity < 1) {
        throw Object.assign(new Error("Quantity must be at least 1"), { status: 400 });
      }

      const unitPriceUsd = Math.round((li.unitPrice / rate) * 10000) / 10000;
      const subtotalItemUsd = Math.round(unitPriceUsd * li.quantity * 10000) / 10000;
      subtotalUsd += subtotalItemUsd;

      return {
        medicationName: li.medicationName,
        dosage:         li.dosage ?? null,
        quantity:       li.quantity,
        unitPriceUsd,
        subtotalUsd:    subtotalItemUsd,
      };
    });

    const deliveryFeeUsd  = Math.round((deliveryFee / rate) * 10000) / 10000;
    const totalAmountUsd  = Math.round((subtotalUsd + deliveryFeeUsd) * 10000) / 10000;

    // Generate pharmacy-scoped sequential reference
    const seq       = await invoiceRepo.getNextSequence(pharmacyId);
    const reference = `#${seq}`;

    const invoice = await invoiceRepo.save({
      reference,
      prescriptionId,
      pharmacyId,
      patientId:      prescription.patientId,
      subtotalUsd,
      deliveryFeeUsd,
      totalAmountUsd,
      displayCurrency,
      exchangeRateToUsd: rate,
      paymentMethod,
      status:            InvoiceStatus.DRAFT,
      notes:             notes ?? null,
      dueAt:             dueAt ? new Date(dueAt) : null,
      lineItems:         itemsData,
    });

    const saved = await invoiceRepo.findById(invoice.id);
    return formatInvoice(saved, displayCurrency);
  },

  /**
   * List invoices for a pharmacy with filters.
   */
  async listInvoices(pharmacyId, query) {
    const { status, search, prescriptionId, dateFrom, dateTo, page = 1, limit = 20 } = query;
    const safeLimit = Math.min(parseInt(limit) || 20, 100);
    const safePage  = parseInt(page) || 1;

    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);
    const displayCurrency = pharmacy.defaultCurrency || "NGN";

    const { invoices, total } = await invoiceRepo.findByPharmacy({
      pharmacyId, status, search, prescriptionId,
      dateFrom: dateFrom ? new Date(dateFrom) : null,
      dateTo:   dateTo   ? new Date(dateTo)   : null,
      page: safePage, limit: safeLimit,
    });

    const formatted = await Promise.all(
      invoices.map((inv) => formatInvoice(inv, displayCurrency))
    );

    return { invoices: formatted, total, page: safePage, limit: safeLimit };
  },

  /**
   * Get a single invoice by ID (pharmacy view).
   */
  async getInvoice(pharmacyId, invoiceId) {
    const invoice = await invoiceRepo.findByIdAndPharmacy(invoiceId, pharmacyId);
    if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });

    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);
    const displayCurrency = pharmacy.defaultCurrency || "NGN";

    return formatInvoice(invoice, displayCurrency);
  },

  /**
   * Update a draft invoice.
   */
  async updateInvoice(pharmacyId, invoiceId, body) {
    const invoice = await invoiceRepo.findByIdAndPharmacy(invoiceId, pharmacyId);
    if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw Object.assign(new Error("Only draft invoices can be updated"), { status: 422 });
    }

    const pharmacy        = await pharmacyProfileRepo.findById(pharmacyId);
    const displayCurrency = pharmacy.defaultCurrency || "NGN";
    const rates           = await CurrencyService.getExchangeRates();
    const rate            = rates[displayCurrency] || 1;

    const updates = {};

    if (body.deliveryFee !== undefined) {
      updates.deliveryFeeUsd = Math.round((body.deliveryFee / rate) * 10000) / 10000;
    }
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.dueAt !== undefined) updates.dueAt = body.dueAt ? new Date(body.dueAt) : null;

    if (body.lineItems && body.lineItems.length > 0) {
      // Replace line items — delete existing then save new ones via cascade
      let subtotalUsd = 0;
      const itemsData = body.lineItems.map((li) => {
        const unitPriceUsd   = Math.round((li.unitPrice / rate) * 10000) / 10000;
        const subtotalItemUsd = Math.round(unitPriceUsd * li.quantity * 10000) / 10000;
        subtotalUsd += subtotalItemUsd;
        return { medicationName: li.medicationName, dosage: li.dosage ?? null, quantity: li.quantity, unitPriceUsd, subtotalUsd: subtotalItemUsd };
      });

      const deliveryFeeUsd = updates.deliveryFeeUsd ?? parseFloat(invoice.deliveryFeeUsd);
      updates.subtotalUsd    = subtotalUsd;
      updates.deliveryFeeUsd = deliveryFeeUsd;
      updates.totalAmountUsd = Math.round((subtotalUsd + deliveryFeeUsd) * 10000) / 10000;

      // Remove old line items and save new
      await AppDataSource.getRepository("InvoiceLineItem").delete({ invoiceId });
      await AppDataSource.getRepository("InvoiceLineItem").save(
        itemsData.map((li) => ({ ...li, invoiceId }))
      );
    } else if (updates.deliveryFeeUsd !== undefined) {
      updates.totalAmountUsd = Math.round(
        (parseFloat(invoice.subtotalUsd) + updates.deliveryFeeUsd) * 10000
      ) / 10000;
    }

    await invoiceRepo.update(invoiceId, updates);
    const updated = await invoiceRepo.findByIdAndPharmacy(invoiceId, pharmacyId);
    return formatInvoice(updated, displayCurrency);
  },

  /**
   * Send invoice to patient — draft → sent.
   * Sets dueAt to 7 days from now if not already set.
   * Moves prescription to awaiting_payment.
   */
  async sendInvoice(pharmacyId, invoiceId) {
    const invoice = await invoiceRepo.findByIdAndPharmacy(invoiceId, pharmacyId);
    if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw Object.assign(new Error("Only draft invoices can be sent"), { status: 422 });
    }

    const dueAt = invoice.dueAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await invoiceRepo.update(invoiceId, { status: InvoiceStatus.SENT, dueAt });

    // Advance prescription status
    await prescriptionRepo.updateStatus(invoice.prescriptionId, PrescriptionStatus.AWAITING_PAYMENT);

    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);

    // Notify patient (push + email)
    try {
      const updatedForNotif = await invoiceRepo.findByIdAndPharmacy(invoiceId, pharmacyId);
      const dispCurrency    = pharmacy.defaultCurrency || "NGN";
      const rates           = await CurrencyService.getExchangeRates();
      const displayTotal    = Math.round(parseFloat(updatedForNotif.totalAmountUsd) * (rates[dispCurrency] || 1) * 100) / 100;

      await notificationService.createNotification(invoice.patientId, {
        title:   "New Invoice from Pharmacy",
        message: `You have a new invoice ${invoice.reference} for your prescription.`,
        type:    "invoice_sent",
        data:    { invoiceId: invoice.id },
      });

      const patient = await userRepo.findById(invoice.patientId);
      if (patient?.email) {
        await pharmacyEmailHelper.sendInvoiceSentEmail({
          to:          patient.email,
          patientName: `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() || patient.email,
          pharmacyName: pharmacy.pharmacyName,
          reference:    invoice.reference,
          invoiceId:    invoice.id,
          totalAmount:  displayTotal,
          currency:     dispCurrency,
          dueAt:        dueAt,
        });
      }
    } catch (err) {
      console.error("Notification send failed:", err.message);
    }
    const updated  = await invoiceRepo.findByIdAndPharmacy(invoiceId, pharmacyId);
    return formatInvoice(updated, pharmacy.defaultCurrency || "NGN");
  },

  /**
   * Cancel an invoice. Cannot cancel a paid invoice.
   * Reverts prescription to under_review if it was awaiting_payment.
   */
  async cancelInvoice(pharmacyId, invoiceId) {
    const invoice = await invoiceRepo.findByIdAndPharmacy(invoiceId, pharmacyId);
    if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });
    if (invoice.status === InvoiceStatus.PAID) {
      throw Object.assign(new Error("Cannot cancel a paid invoice"), { status: 422 });
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw Object.assign(new Error("Invoice is already cancelled"), { status: 422 });
    }

    await invoiceRepo.update(invoiceId, { status: InvoiceStatus.CANCELLED });

    // Revert prescription if it was waiting for this invoice's payment
    const prescription = await prescriptionRepo.findById(invoice.prescriptionId);
    if (prescription?.status === PrescriptionStatus.AWAITING_PAYMENT) {
      await prescriptionRepo.updateStatus(invoice.prescriptionId, PrescriptionStatus.UNDER_REVIEW);
    }

    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);
    const updated  = await invoiceRepo.findByIdAndPharmacy(invoiceId, pharmacyId);
    return formatInvoice(updated, pharmacy.defaultCurrency || "NGN");
  },

  /**
   * Manually mark a pay_on_pickup invoice as paid.
   * Credits pharmacy wallet immediately (no escrow hold for cash).
   */
  async markPaid(pharmacyId, invoiceId) {
    const invoice = await invoiceRepo.findByIdAndPharmacy(invoiceId, pharmacyId);
    if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });
    if (invoice.paymentMethod !== InvoicePaymentMethod.PAY_ON_PICKUP) {
      throw Object.assign(
        new Error("mark-paid is only allowed for pay_on_pickup invoices"),
        { status: 422 }
      );
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw Object.assign(new Error("Invoice is already paid"), { status: 422 });
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw Object.assign(new Error("Cannot mark a cancelled invoice as paid"), { status: 422 });
    }

    await AppDataSource.transaction(async (trx) => {
      // Mark invoice paid
      await trx.update("Invoice", { id: invoiceId }, {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
      });

      // Advance prescription
      await trx.update("Prescription", { id: invoice.prescriptionId }, {
        status: PrescriptionStatus.IN_PROGRESS,
      });

      // Credit wallet immediately — no escrow hold for cash
      const wallet = await pharmacyWalletRepo.findByPharmacyId(pharmacyId);
      const amountUsd = parseFloat(invoice.totalAmountUsd);

      await trx.update("PharmacyWallet", { id: wallet.id }, {
        availableBalanceUsd: () => `"availableBalanceUsd" + ${amountUsd}`,
        totalEarningsUsd:    () => `"totalEarningsUsd" + ${amountUsd}`,
      });

      // Create wallet transaction
      const updatedWallet = await trx.findOne("PharmacyWallet", { where: { id: wallet.id } });
      await trx.save("PharmacyWalletTransaction", {
        walletId:        wallet.id,
        pharmacyId,
        type:            WalletTransactionType.CREDIT,
        status:          WalletTransactionStatus.COMPLETED,
        category:        WalletTransactionCategory.INVOICE_PAYMENT,
        amountUsd,
        balanceAfterUsd: parseFloat(updatedWallet.availableBalanceUsd),
        description:     `Cash/POS payment for invoice ${invoice.reference}`,
        reference:       invoice.reference,
        invoiceId:       invoice.id,
        invoiceRef:      invoice.reference,
        patientId:       invoice.patientId,
        prescriptionId:  invoice.prescriptionId,
        settledAt:       new Date(),
      });
    });

    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);

    // Notify patient (push + email)
    try {
      const dispCurrency = pharmacy.defaultCurrency || "NGN";
      const rates        = await CurrencyService.getExchangeRates();
      const displayTotal = Math.round(parseFloat(invoice.totalAmountUsd) * (rates[dispCurrency] || 1) * 100) / 100;

      await notificationService.createNotification(invoice.patientId, {
        title:   "Payment Confirmed",
        message: `Your payment for invoice ${invoice.reference} has been confirmed.`,
        type:    "payment_confirmed",
        data:    { invoiceId: invoice.id },
      });

      const patient = await userRepo.findById(invoice.patientId);
      if (patient?.email) {
        await pharmacyEmailHelper.sendPaymentConfirmedPatientEmail({
          to:           patient.email,
          patientName:  `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() || patient.email,
          pharmacyName: pharmacy.pharmacyName,
          reference:    invoice.reference,
          invoiceId:    invoice.id,
          totalAmount:  displayTotal,
          currency:     dispCurrency,
        });
      }
    } catch (err) {
      console.error("Notification send failed:", err.message);
    }

    const updated  = await invoiceRepo.findByIdAndPharmacy(invoiceId, pharmacyId);
    return formatInvoice(updated, pharmacy.defaultCurrency || "NGN");
  },
};

module.exports = invoiceService;
module.exports.formatInvoice = formatInvoice;
module.exports.toUsd         = toUsd;
module.exports.fromUsd       = fromUsd;
