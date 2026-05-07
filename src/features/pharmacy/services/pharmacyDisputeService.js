const AppDataSource         = require("../../../config/database");

const pharmacyDisputeRepo   = require("../repositories/pharmacyDisputeRepository");
const invoiceRepo           = require("../repositories/invoiceRepository");
const pharmacyWalletRepo    = require("../repositories/pharmacyWalletRepository");

const InvoiceSchema         = require("../entities/Invoice");
const DisputeSchema         = require("../entities/PharmacyDispute");
const WalletTxnSchema       = require("../entities/PharmacyWalletTransaction");

const NotificationService   = require("../../notifications/services/notificationService");
const pharmacyEmailHelper   = require("../../../shared/services/email/helper/pharmacy");
const userRepo              = require("../../auth/repositories/userRepository");
const { getIO }             = require("../../../config/websocket");

const notificationService   = new NotificationService();

const { InvoiceStatus }                                                      = InvoiceSchema;
const { DisputeStatus, DisputeResolution, RaisedBy }                         = DisputeSchema;
const { WalletTransactionType, WalletTransactionStatus, WalletTransactionCategory } = WalletTxnSchema;

const pharmacyDisputeService = {

  /**
   * GET /pharmacy/wallet/disputes — list disputes for pharmacy.
   */
  async listDisputes(pharmacyId, query) {
    const { status, page = 1, limit = 20 } = query;
    const safeLimit = Math.min(parseInt(limit) || 20, 100);
    const safePage  = parseInt(page) || 1;

    const { disputes, total } = await pharmacyDisputeRepo.findByPharmacy({
      pharmacyId, status, page: safePage, limit: safeLimit,
    });

    return { disputes: disputes.map(formatDispute), total, page: safePage, limit: safeLimit };
  },

  /**
   * POST /pharmacy/wallet/disputes/:disputeId/respond
   * Pharmacy submits a response to a dispute.
   */
  async respondToDispute(pharmacyId, disputeId, body) {
    const { message } = body;
    if (!message) throw Object.assign(new Error("message is required"), { status: 400 });

    const dispute = await pharmacyDisputeRepo.findByIdAndPharmacy(disputeId, pharmacyId);
    if (!dispute) throw Object.assign(new Error("Dispute not found"), { status: 404 });

    const respondableStatuses = [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW];
    if (!respondableStatuses.includes(dispute.status)) {
      throw Object.assign(
        new Error(`Cannot respond to a dispute with status: ${dispute.status}`),
        { status: 422 }
      );
    }

    const updates = {
      pharmacyResponse:   message,
      pharmacyResponseAt: new Date(),
    };

    // Auto-advance from open → under_review
    if (dispute.status === DisputeStatus.OPEN) {
      updates.status = DisputeStatus.UNDER_REVIEW;
    }

    await pharmacyDisputeRepo.update(disputeId, updates);
    const updated = await pharmacyDisputeRepo.findByIdAndPharmacy(disputeId, pharmacyId);
    return formatDispute(updated);
  },

  /**
   * POST /patient/invoices/:id/dispute (patient raises dispute).
   * Only on paid invoices within 7 days of payment.
   */
  async raiseDispute(patientId, invoiceId, body) {
    const { reason, description } = body;

    if (!reason || !description) {
      throw Object.assign(new Error("reason and description are required"), { status: 400 });
    }

    const invoice = await invoiceRepo.findByIdAndPatient(invoiceId, patientId);
    if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });

    if (invoice.status !== InvoiceStatus.PAID) {
      throw Object.assign(new Error("Disputes can only be raised on paid invoices"), { status: 422 });
    }

    // Must be within 7 days of payment
    const paidAt      = new Date(invoice.paidAt);
    const daysSince   = (Date.now() - paidAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 7) {
      throw Object.assign(
        new Error("Dispute window has closed (7 days after payment)"),
        { status: 422 }
      );
    }

    // One active dispute per invoice
    const existingOpen = await pharmacyDisputeRepo.hasOpenDispute(invoiceId);
    if (existingOpen) {
      throw Object.assign(new Error("An open dispute already exists for this invoice"), { status: 409 });
    }

    const dispute = await pharmacyDisputeRepo.save({
      invoiceId,
      pharmacyId: invoice.pharmacyId,
      patientId,
      amountUsd:  parseFloat(invoice.totalAmountUsd),
      status:     DisputeStatus.OPEN,
      resolution: DisputeResolution.PENDING,
      reason,
      description,
      raisedBy:   RaisedBy.PATIENT,
    });

    // Notify pharmacy (push + email)
    try {
      const pharmacy = await AppDataSource.getRepository("PharmacyProfile").findOne({
        where: { id: invoice.pharmacyId },
        relations: ["user"],
      });

      if (pharmacy) {
        // Real-time: all pharmacy staff see new dispute immediately
        try {
          const io = getIO();
          io.to(`pharmacy_${invoice.pharmacyId}`).emit("dispute_raised", {
            disputeId:  dispute.id,
            invoiceId,
            reference:  invoice.reference,
          });
        } catch (_) {}

        await notificationService.createNotification(
          pharmacy.userId,
          "dispute_raised",
          `A dispute has been raised for invoice ${invoice.reference}.`,
          { disputeId: dispute.id, invoiceId }
        );

        if (pharmacy.user?.email) {
          const patient = await userRepo.findById(patientId);
          await pharmacyEmailHelper.sendDisputeRaisedEmail({
            to:           pharmacy.user.email,
            pharmacyName: pharmacy.pharmacyName,
            patientName:  patient
              ? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() || patient.email
              : "Patient",
            invoiceRef:   invoice.reference,
            disputeId:    dispute.id,
            reason,
          });
        }
      }
    } catch (err) {
      console.error("Notification send failed:", err.message);
    }

    return formatDispute(dispute);
  },

  /**
   * Admin resolves a dispute.
   * - pharmacy_favour: no wallet action
   * - patient_favour: debit pharmacy wallet, trigger refund
   * - split: partial debit
   */
  async resolveDispute(disputeId, body) {
    const { resolution, splitAmount } = body;

    if (!Object.values(DisputeResolution).includes(resolution) || resolution === DisputeResolution.PENDING) {
      throw Object.assign(new Error("Invalid resolution value"), { status: 400 });
    }

    const dispute = await pharmacyDisputeRepo.findById(disputeId);
    if (!dispute) throw Object.assign(new Error("Dispute not found"), { status: 404 });

    if ([DisputeStatus.RESOLVED, DisputeStatus.CLOSED].includes(dispute.status)) {
      throw Object.assign(new Error("Dispute is already resolved"), { status: 422 });
    }

    const debitAmount =
      resolution === DisputeResolution.PATIENT_FAVOUR ? parseFloat(dispute.amountUsd) :
      resolution === DisputeResolution.SPLIT          ? parseFloat(splitAmount || dispute.amountUsd / 2) :
      0;

    if (debitAmount > 0) {
      await AppDataSource.transaction(async (trx) => {
        // Debit pharmacy wallet
        const wallet = await trx.findOne("PharmacyWallet", { where: { pharmacyId: dispute.pharmacyId } });
        if (wallet) {
          await trx.update("PharmacyWallet", { id: wallet.id }, {
            availableBalanceUsd: () => `GREATEST("availableBalanceUsd" - ${debitAmount}, 0)`,
            totalEarningsUsd:    () => `GREATEST("totalEarningsUsd" - ${debitAmount}, 0)`,
          });

          const updatedWallet = await trx.findOne("PharmacyWallet", { where: { id: wallet.id } });
          await trx.save("PharmacyWalletTransaction", {
            walletId:        wallet.id,
            pharmacyId:      dispute.pharmacyId,
            type:            WalletTransactionType.DEBIT,
            status:          WalletTransactionStatus.COMPLETED,
            category:        WalletTransactionCategory.DISPUTE_REVERSAL,
            amountUsd:       debitAmount,
            balanceAfterUsd: parseFloat(updatedWallet.availableBalanceUsd),
            description:     `Dispute resolution (${resolution}) for invoice ${dispute.invoice?.reference ?? dispute.invoiceId}`,
            reference:       `DISPUTE-${disputeId}`,
            invoiceId:       dispute.invoiceId,
          });
        }

        await trx.update("PharmacyDispute", { id: disputeId }, {
          status:     DisputeStatus.RESOLVED,
          resolution,
          resolvedAt: new Date(),
        });
      });
    } else {
      // pharmacy_favour — no wallet action
      await pharmacyDisputeRepo.update(disputeId, {
        status:     DisputeStatus.RESOLVED,
        resolution,
        resolvedAt: new Date(),
      });
    }

    // Notify both parties (push + email)
    try {
      const resolvedDispute = await pharmacyDisputeRepo.findById(disputeId);
      const invoiceRef      = resolvedDispute?.invoice?.reference ?? disputeId;

      const [patient, pharmacy] = await Promise.all([
        userRepo.findById(dispute.patientId),
        AppDataSource.getRepository("PharmacyProfile").findOne({
          where: { id: dispute.pharmacyId },
          relations: ["user"],
        }),
      ]);

      await Promise.all([
        notificationService.createNotification(
          dispute.patientId,
          "dispute_resolved",
          `Your dispute has been resolved (${resolution.replace("_", " ")}).`,
          { disputeId }
        ),
        pharmacy
          ? notificationService.createNotification(
              pharmacy.userId,
              "dispute_resolved",
              `Dispute ${disputeId} has been resolved (${resolution.replace("_", " ")}).`,
              { disputeId }
            )
          : Promise.resolve(),
      ]);

      // Email patient
      if (patient?.email) {
        await pharmacyEmailHelper.sendDisputeResolvedEmail({
          to:            patient.email,
          recipientName: `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() || patient.email,
          invoiceRef,
          disputeId,
          resolution,
        });
      }

      // Email pharmacy admin
      if (pharmacy?.user?.email) {
        await pharmacyEmailHelper.sendDisputeResolvedEmail({
          to:            pharmacy.user.email,
          recipientName: pharmacy.pharmacyName,
          invoiceRef,
          disputeId,
          resolution,
        });
      }
    } catch (err) {
      console.error("Notification send failed:", err.message);
    }

    return formatDispute(await pharmacyDisputeRepo.findById(disputeId));
  },
};

function formatDispute(d) {
  return {
    id:                 d.id,
    invoiceId:          d.invoiceId,
    invoiceRef:         d.invoice?.reference ?? null,
    patientName:        null, // Populated by join when needed
    amount:             parseFloat(d.amountUsd),
    status:             d.status,
    resolution:         d.resolution,
    reason:             d.reason,
    description:        d.description,
    raisedBy:           d.raisedBy,
    pharmacyResponse:   d.pharmacyResponse,
    pharmacyResponseAt: d.pharmacyResponseAt,
    createdAt:          d.createdAt,
    updatedAt:          d.updatedAt,
    resolvedAt:         d.resolvedAt,
  };
}

module.exports = pharmacyDisputeService;
