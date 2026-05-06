const { AppDataSource }       = require("../../../config/database");

const invoiceRepo             = require("../repositories/invoiceRepository");
const pharmacyPaymentRepo     = require("../repositories/pharmacyPaymentRepository");
const pharmacyWalletRepo      = require("../repositories/pharmacyWalletRepository");
const walletTxnRepo           = require("../repositories/pharmacyWalletTransactionRepository");
const prescriptionRepo        = require("../repositories/prescriptionRepository");
const pharmacyDisputeRepo     = require("../repositories/pharmacyDisputeRepository");

const InvoiceSchema           = require("../entities/Invoice");
const PaymentSchema           = require("../entities/PharmacyPayment");
const WalletTxnSchema         = require("../entities/PharmacyWalletTransaction");
const { PrescriptionStatus }  = require("../entities/Prescription");

const CurrencyService         = require("../../payments/services/currencyService");
const NotificationService     = require("../../notifications/services/notificationService");
const pharmacyEmailHelper     = require("../../../shared/services/email/helper/pharmacy");
const { formatInvoice }       = require("./invoiceService");

const axios                   = require("axios");

const notificationService     = new NotificationService();

const { InvoiceStatus }                                                      = InvoiceSchema;
const { PharmacyPaymentStatus, PaymentProvider }                             = PaymentSchema;
const { WalletTransactionType, WalletTransactionStatus, WalletTransactionCategory } = WalletTxnSchema;

// ─── helpers ────────────────────────────────────────────────────────────────

function generatePaymentReference() {
  const seq = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `COSMIC-PAY-${Date.now()}-${seq}`;
}

/**
 * Determine the best gateway provider and currency for the patient's location.
 * Falls back to USD if the patient's currency is not supported by either gateway.
 */
async function resolvePaymentCurrency(patientCountryCode) {
  const localCurrency = CurrencyService.getCurrencyForCountry(patientCountryCode);

  const [flutterwaveOk, paystackOk] = await Promise.all([
    CurrencyService.isCurrencySupportedByProvider(localCurrency, "flutterwave"),
    CurrencyService.isCurrencySupportedByProvider(localCurrency, "paystack"),
  ]);

  if (paystackOk)      return { currency: localCurrency, provider: PaymentProvider.PAYSTACK };
  if (flutterwaveOk)   return { currency: localCurrency, provider: PaymentProvider.FLUTTERWAVE };

  // Neither supports local currency → fall back to USD
  return { currency: "USD", provider: PaymentProvider.PAYSTACK, fallback: true };
}

// ─── service ────────────────────────────────────────────────────────────────

const pharmacyPaymentService = {

  /**
   * GET /patient/invoices — list invoices for patient.
   */
  async listPatientInvoices(patientId, query) {
    const { status, page = 1, limit = 20 } = query;
    const safeLimit = Math.min(parseInt(limit) || 20, 100);
    const safePage  = parseInt(page) || 1;

    // Default: hide cancelled invoices from patient view unless explicitly requested
    const effectiveStatus = status || { $not: "cancelled" };

    const { invoices, total } = await invoiceRepo.findByPatient({
      patientId, status, excludeCancelled: !status, page: safePage, limit: safeLimit,
    });

    // For patients, show amounts in their preferred/local currency
    const formatted = await Promise.all(
      invoices.map((inv) => formatInvoice(inv, inv.displayCurrency, true))
    );

    return { invoices: formatted, total, page: safePage, limit: safeLimit };
  },

  /**
   * GET /patient/invoices/:id — get a single invoice for patient.
   */
  async getPatientInvoice(patientId, invoiceId) {
    const invoice = await invoiceRepo.findByIdAndPatient(invoiceId, patientId);
    if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });

    return formatInvoice(invoice, invoice.displayCurrency, true);
  },

  /**
   * PATCH /patient/invoices/:id/viewed — mark invoice as viewed.
   */
  async markViewed(patientId, invoiceId) {
    const invoice = await invoiceRepo.findByIdAndPatient(invoiceId, patientId);
    if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });

    if (invoice.status === InvoiceStatus.SENT) {
      await invoiceRepo.update(invoiceId, { status: InvoiceStatus.VIEWED });
    }

    const updated = await invoiceRepo.findByIdAndPatient(invoiceId, patientId);
    return formatInvoice(updated, updated.displayCurrency, true);
  },

  /**
   * POST /patient/payments/initiate
   * Idempotent: returns existing pending payment if one exists for this invoice.
   * Rate limited: max 5 attempts per invoice per hour.
   */
  async initiatePayment(patientId, body, patientCountryCode) {
    const { invoiceId, provider: requestedProvider } = body;
    if (!invoiceId) throw Object.assign(new Error("invoiceId is required"), { status: 400 });

    const validProviders = Object.values(PaymentProvider);
    if (requestedProvider && !validProviders.includes(requestedProvider)) {
      throw Object.assign(
        new Error(`Invalid provider. Must be one of: ${validProviders.join(", ")}`),
        { status: 400 }
      );
    }

    const invoice = await invoiceRepo.findByIdAndPatient(invoiceId, patientId);
    if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });

    // Must be in a payable status
    const payableStatuses = [InvoiceStatus.SENT, InvoiceStatus.VIEWED, InvoiceStatus.AWAITING_PAYMENT];
    if (!payableStatuses.includes(invoice.status)) {
      throw Object.assign(
        new Error(`Invoice cannot be paid in its current status (${invoice.status})`),
        { status: 422 }
      );
    }

    // Resolve provider + currency: patient's explicit choice takes priority over auto-detection
    const countryCode = patientCountryCode || "NG";
    let currency, provider;
    if (requestedProvider) {
      provider = requestedProvider;
      const localCurrency = CurrencyService.getCurrencyForCountry(countryCode);
      const supported = await CurrencyService.isCurrencySupportedByProvider(localCurrency, provider);
      currency = supported ? localCurrency : "NGN";
    } else {
      const resolved = await resolvePaymentCurrency(countryCode);
      currency  = resolved.currency;
      provider  = resolved.provider;
    }

    // Use the exchange rate locked at invoice creation when paying in the same currency —
    // guarantees the patient pays exactly what the pharmacy quoted, regardless of live rate shifts.
    const amountUsd = parseFloat(invoice.totalAmountUsd);
    let amountLocal, rate;
    if (currency === invoice.displayCurrency && invoice.exchangeRateToUsd) {
      rate        = parseFloat(invoice.exchangeRateToUsd);
      amountLocal = Math.round(amountUsd * rate * 100) / 100;
    } else {
      const rates = await CurrencyService.getExchangeRates();
      rate        = rates[currency] || 1;
      amountLocal = Math.round(amountUsd * rate * 100) / 100;
    }

    // Idempotency — reuse an existing pending payment only if it matches the current
    // currency and provider. A mismatch means the pharmacy fixed their settings after
    // the bad payment was created; void it so a correct one can be issued.
    const existing = await pharmacyPaymentRepo.findPendingByInvoice(invoiceId);
    if (existing) {
      const currencyMatches  = existing.currency === currency;
      const providerMatches  = !requestedProvider || existing.provider === requestedProvider;
      const amountMatches    = Math.abs(parseFloat(existing.amountLocal) - amountLocal) < 1;

      if (currencyMatches && providerMatches && amountMatches) {
        return {
          paymentId:        existing.id,
          invoiceId:        existing.invoiceId,
          amount:           parseFloat(existing.amountLocal),
          currency:         existing.currency,
          status:           existing.status,
          authorizationUrl: existing.authorizationUrl,
          reference:        existing.reference,
        };
      }

      // Stale payment — void it so we can create a correct one
      await pharmacyPaymentRepo.update(existing.id, { status: "failed" });
    }

    // Rate limit: max 5 attempts per invoice per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const attempts   = await pharmacyPaymentRepo.countRecentAttempts(invoiceId, oneHourAgo);
    if (attempts >= 5) {
      throw Object.assign(
        new Error("Too many payment attempts. Please try again later."),
        { status: 429 }
      );
    }

    const reference = generatePaymentReference();

    // Build Paystack/Flutterwave payload
    let authorizationUrl = null;
    let providerReference = reference;

    const metadata = {
      invoiceId:      invoice.id,
      invoiceRef:     invoice.reference,
      patientId,
      pharmacyId:     invoice.pharmacyId,
      prescriptionId: invoice.prescriptionId,
    };

    try {
      if (provider === PaymentProvider.PAYSTACK) {
        authorizationUrl = await pharmacyPaymentService._initPaystack(
          patientId, invoice, amountLocal, currency, reference, metadata
        );
      } else {
        authorizationUrl = await pharmacyPaymentService._initFlutterwave(
          patientId, invoice, amountLocal, currency, reference, metadata
        );
      }
    } catch (err) {
      const gatewayDetail = err.response?.data?.message ?? err.response?.data ?? err.message;
      console.error("Payment gateway initiation failed:", gatewayDetail, err.response?.data);
      throw Object.assign(
        new Error(`Payment gateway error: ${typeof gatewayDetail === "string" ? gatewayDetail : JSON.stringify(gatewayDetail)}`),
        { status: 502 }
      );
    }

    // Save payment record
    const payment = await pharmacyPaymentRepo.save({
      invoiceId,
      patientId,
      pharmacyId:       invoice.pharmacyId,
      reference,
      amountLocal,
      currency,
      exchangeRate:     rate,
      amountUsd,
      status:           PharmacyPaymentStatus.PENDING,
      provider,
      authorizationUrl,
      providerReference: reference,
      metadata,
    });

    return {
      paymentId:        payment.id,
      invoiceId:        payment.invoiceId,
      amount:           parseFloat(payment.amountLocal),
      currency:         payment.currency,
      status:           payment.status,
      authorizationUrl: payment.authorizationUrl,
      reference:        payment.reference,
    };
  },

  async _initPaystack(patientId, invoice, amountLocal, currency, reference, metadata) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("PAYSTACK_SECRET_KEY not configured");

    // Paystack amounts in subunits (kobo for NGN, cents for USD)
    const subunitAmount = Math.round(amountLocal * 100);

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email:     invoice.patient?.email ?? `patient-${patientId}@cosmicforge.health`,
        amount:    subunitAmount,
        currency,
        reference,
        metadata,
        callback_url: process.env.PAYMENT_CALLBACK_URL,
      },
      {
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data?.status) throw new Error("Paystack initialization failed");
    return response.data.data.authorization_url;
  },

  async _initFlutterwave(patientId, invoice, amountLocal, currency, reference, metadata) {
    const secret = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secret) throw new Error("FLUTTERWAVE_SECRET_KEY not configured");

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref:       reference,
        amount:       amountLocal,
        currency,
        redirect_url: process.env.PAYMENT_CALLBACK_URL,
        customer: {
          email:      invoice.patient?.email ?? `patient-${patientId}@cosmicforge.health`,
          name:       invoice.patient
            ? `${invoice.patient.firstName} ${invoice.patient.lastName}`
            : "Patient",
        },
        meta: metadata,
      },
      {
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data?.status !== "success") throw new Error("Flutterwave initialization failed");
    return response.data.data.link;
  },

  /**
   * GET /patient/payments/verify/:reference
   * Fallback verification after returning from gateway.
   * Primary confirmation is via webhook.
   */
  async verifyPayment(patientId, reference) {
    const payment = await pharmacyPaymentRepo.findByReference(reference);
    if (!payment) throw Object.assign(new Error("Payment record not found"), { status: 404 });

    // If already succeeded, just return current state
    if (payment.status === PharmacyPaymentStatus.SUCCESS) {
      return {
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        amount:    parseFloat(payment.amountLocal),
        currency:  payment.currency,
        status:    "success",
        reference: payment.reference,
      };
    }

    // Verify with gateway
    let gatewaySuccess = false;
    try {
      if (payment.provider === PaymentProvider.PAYSTACK) {
        gatewaySuccess = await pharmacyPaymentService._verifyPaystack(reference);
      } else {
        gatewaySuccess = await pharmacyPaymentService._verifyFlutterwave(reference);
      }
    } catch (err) {
      console.error("Gateway verification error:", err.message);
    }

    if (gatewaySuccess && payment.status !== PharmacyPaymentStatus.SUCCESS) {
      // Trigger the same atomic logic as the webhook
      await pharmacyPaymentService.handlePaymentSuccess(payment.invoiceId, payment);
    }

    const updated = await pharmacyPaymentRepo.findByReference(reference);
    return {
      paymentId: updated.id,
      invoiceId: updated.invoiceId,
      amount:    parseFloat(updated.amountLocal),
      currency:  updated.currency,
      status:    updated.status === PharmacyPaymentStatus.SUCCESS ? "success" : "pending",
      reference: updated.reference,
    };
  },

  async _verifyPaystack(reference) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return false;

    const resp = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );

    return resp.data?.data?.status === "success";
  },

  async _verifyFlutterwave(reference) {
    const secret = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secret) return false;

    const resp = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${reference}/verify`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );

    return resp.data?.data?.status === "successful";
  },

  /**
   * Core atomic operation triggered by webhook charge.success OR manual verify.
   * Executes in a single DB transaction:
   *   1. Invoice → paid
   *   2. Prescription → in_progress
   *   3. Create wallet transaction (credit, pending escrow)
   *   4. Update wallet pendingClearance
   *   5. Payment record → success
   */
  async handlePaymentSuccess(invoiceId, payment) {
    const invoice = await invoiceRepo.findById(invoiceId);
    if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);
    if (invoice.status === InvoiceStatus.PAID) return; // Already processed — idempotent

    const amountUsd = parseFloat(invoice.totalAmountUsd);

    await AppDataSource.transaction(async (trx) => {
      // 1. Invoice paid
      await trx.update("Invoice", { id: invoiceId }, {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
      });

      // 2. Prescription in_progress
      await trx.update("Prescription", { id: invoice.prescriptionId }, {
        status: PrescriptionStatus.IN_PROGRESS,
      });

      // 3. Credit pharmacy wallet (escrow — pendingClearance for online payments)
      const wallet = await trx.findOne("PharmacyWallet", { where: { pharmacyId: invoice.pharmacyId } });
      if (wallet) {
        await trx.update("PharmacyWallet", { id: wallet.id }, {
          pendingClearanceUsd: () => `"pendingClearanceUsd" + ${amountUsd}`,
          totalEarningsUsd:    () => `"totalEarningsUsd" + ${amountUsd}`,
        });

        const updatedWallet = await trx.findOne("PharmacyWallet", { where: { id: wallet.id } });

        // 4. Wallet transaction record
        await trx.save("PharmacyWalletTransaction", {
          walletId:        wallet.id,
          pharmacyId:      invoice.pharmacyId,
          type:            WalletTransactionType.CREDIT,
          status:          WalletTransactionStatus.PENDING,
          category:        WalletTransactionCategory.INVOICE_PAYMENT,
          amountUsd,
          balanceAfterUsd: parseFloat(updatedWallet.pendingClearanceUsd),
          description:     `Online payment for invoice ${invoice.reference}`,
          reference:       payment?.reference ?? invoiceId,
          invoiceId:       invoice.id,
          invoiceRef:      invoice.reference,
          patientId:       invoice.patientId,
          prescriptionId:  invoice.prescriptionId,
        });
      }

      // 5. Payment record success
      if (payment?.id) {
        await trx.update("PharmacyPayment", { id: payment.id }, {
          status: PharmacyPaymentStatus.SUCCESS,
        });
      }
    });

    // Notify both sides (push + email for patient)
    try {
      const pharmacy = await AppDataSource.getRepository("PharmacyProfile").findOne({
        where: { id: invoice.pharmacyId },
      });

      await Promise.all([
        notificationService.createNotification(invoice.patientId, {
          title:   "Payment Confirmed",
          message: `Your payment for invoice ${invoice.reference} was successful.`,
          type:    "payment_confirmed",
          data:    { invoiceId: invoice.id },
        }),
        pharmacy
          ? notificationService.createNotification(pharmacy.userId, {
              title:   "Payment Received",
              message: `Invoice ${invoice.reference} has been paid.`,
              type:    "payment_received",
              data:    { invoiceId: invoice.id },
            })
          : Promise.resolve(),
      ]);

      // Email patient
      if (invoice.patient?.email) {
        const rates        = await CurrencyService.getExchangeRates();
        const dispCurrency = invoice.displayCurrency || "USD";
        const displayTotal = Math.round(parseFloat(invoice.totalAmountUsd) * (rates[dispCurrency] || 1) * 100) / 100;

        await pharmacyEmailHelper.sendPaymentConfirmedPatientEmail({
          to:           invoice.patient.email,
          patientName:  `${invoice.patient.firstName ?? ""} ${invoice.patient.lastName ?? ""}`.trim() || invoice.patient.email,
          pharmacyName: pharmacy?.pharmacyName ?? "The pharmacy",
          reference:    invoice.reference,
          invoiceId:    invoice.id,
          totalAmount:  displayTotal,
          currency:     dispCurrency,
        });
      }
    } catch (err) {
      console.error("Notification send failed:", err.message);
    }
  },

  /**
   * Webhook: transfer.success — mark payout completed, update wallet lastPayoutAt.
   */
  async handleTransferSuccess(transferCode) {
    const payout = await AppDataSource.getRepository("PharmacyPayoutRequest").findOne({
      where: { transferCode },
    });
    if (!payout || payout.status === "completed") return;

    await AppDataSource.transaction(async (trx) => {
      await trx.update("PharmacyPayoutRequest", { id: payout.id }, {
        status:      "completed",
        processedAt: new Date(),
      });
      await trx.update("PharmacyWallet", { pharmacyId: payout.pharmacyId }, {
        lastPayoutAt: new Date(),
      });
      // Update the debit wallet transaction to completed
      await trx
        .createQueryBuilder()
        .update("PharmacyWalletTransaction")
        .set({ status: WalletTransactionStatus.COMPLETED, settledAt: new Date() })
        .where("reference = :ref AND category = :cat", {
          ref: payout.reference,
          cat: WalletTransactionCategory.PAYOUT,
        })
        .execute();
    });

    // Notify pharmacy admin (push + email)
    try {
      const pharmacy = await AppDataSource.getRepository("PharmacyProfile").findOne({
        where: { id: payout.pharmacyId },
        relations: ["user"],
      });
      if (pharmacy) {
        await notificationService.createNotification(pharmacy.userId, {
          title:   "Payout Completed",
          message: `Your payout (${payout.reference}) has been completed.`,
          type:    "payout_completed",
          data:    { payoutId: payout.id },
        });

        if (pharmacy.user?.email) {
          await pharmacyEmailHelper.sendPayoutCompletedEmail({
            to:           pharmacy.user.email,
            pharmacyName: pharmacy.pharmacyName,
            reference:    payout.reference,
            amountUsd:    parseFloat(payout.amountUsd),
          });
        }
      }
    } catch (err) {
      console.error("Notification send failed:", err.message);
    }
  },

  /**
   * Webhook: transfer.failed / transfer.reversed — restore funds.
   */
  async handleTransferFailed(transferCode, reason = "Transfer failed") {
    const payout = await AppDataSource.getRepository("PharmacyPayoutRequest").findOne({
      where: { transferCode },
    });
    if (!payout || ["completed", "failed", "cancelled"].includes(payout.status)) return;

    await AppDataSource.transaction(async (trx) => {
      await trx.update("PharmacyPayoutRequest", { id: payout.id }, {
        status:        "failed",
        processedAt:   new Date(),
        failureReason: reason,
      });

      // Restore funds to available
      await trx.update("PharmacyWallet", { pharmacyId: payout.pharmacyId }, {
        availableBalanceUsd: () => `"availableBalanceUsd" + ${payout.amountUsd}`,
      });

      const wallet = await trx.findOne("PharmacyWallet", { where: { pharmacyId: payout.pharmacyId } });
      await trx.save("PharmacyWalletTransaction", {
        walletId:        wallet.id,
        pharmacyId:      payout.pharmacyId,
        type:            WalletTransactionType.CREDIT,
        status:          WalletTransactionStatus.COMPLETED,
        category:        WalletTransactionCategory.ADJUSTMENT,
        amountUsd:       payout.amountUsd,
        balanceAfterUsd: parseFloat(wallet.availableBalanceUsd),
        description:     `Payout failed — funds restored (${payout.reference})`,
        reference:       `FAILED-${payout.reference}`,
        payoutRequestId: payout.id,
      });
    });

    // Notify pharmacy admin (push + email)
    try {
      const pharmacy = await AppDataSource.getRepository("PharmacyProfile").findOne({
        where: { id: payout.pharmacyId },
        relations: ["user"],
      });
      if (pharmacy) {
        await notificationService.createNotification(pharmacy.userId, {
          title:   "Payout Failed",
          message: `Your payout (${payout.reference}) failed. Funds have been restored.`,
          type:    "payout_failed",
          data:    { payoutId: payout.id, reason },
        });

        if (pharmacy.user?.email) {
          await pharmacyEmailHelper.sendPayoutFailedEmail({
            to:           pharmacy.user.email,
            pharmacyName: pharmacy.pharmacyName,
            reference:    payout.reference,
            amountUsd:    parseFloat(payout.amountUsd),
            reason,
          });
        }
      }
    } catch (err) {
      console.error("Notification send failed:", err.message);
    }
  },
};

module.exports = pharmacyPaymentService;
