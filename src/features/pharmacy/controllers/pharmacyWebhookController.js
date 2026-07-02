const pharmacyPaymentService = require("../services/pharmacyPaymentService");
const pharmacyPaymentRepo    = require("../repositories/pharmacyPaymentRepository");
const patientWalletService   = require("../services/patientWalletService");
const pharmacySessionService = require("../services/pharmacySessionService");

/**
 * POST /api/webhooks/pharmacy/:provider
 * Handles Paystack / Flutterwave webhook events for pharmacy payments.
 * Signature is already verified by middleware before this controller runs.
 */
const pharmacyWebhookController = {
  handleWebhook: async (req, res) => {
    // Respond immediately to acknowledge receipt — processing is async
    res.status(200).json({ received: true });

    const provider = req.params.provider;
    const body     = req.body;

    try {
      if (provider === "paystack") {
        await pharmacyWebhookController._handlePaystack(body);
      } else if (provider === "flutterwave") {
        await pharmacyWebhookController._handleFlutterwave(body);
      }
    } catch (err) {
      console.error(`[PharmacyWebhook] Error processing ${provider} event:`, err.message);
    }
  },

  _handlePaystack: async (body) => {
    const event = body.event;
    const data  = body.data;

    console.log(`[PharmacyWebhook] Paystack event: ${event}`);

    switch (event) {
      case "charge.success": {
        const reference = data?.reference;
        const metadata  = data?.metadata;

        if (!reference) {
          console.warn("[PharmacyWebhook] charge.success: missing reference");
          return;
        }

        // Route to patient wallet top-up handler if applicable
        if (metadata?.type === "wallet_topup") {
          await patientWalletService.handleTopUpSuccess(reference);
          break;
        }

        // Route to prescription cart payment handler
        if (metadata?.type === "prescription_cart") {
          await pharmacySessionService.handleCartPaymentSuccess(metadata.cartId);
          break;
        }

        if (!metadata?.invoiceId) {
          console.warn("[PharmacyWebhook] charge.success: missing invoiceId in metadata");
          return;
        }

        const payment = await pharmacyPaymentRepo.findByReference(reference);
        await pharmacyPaymentService.handlePaymentSuccess(metadata.invoiceId, payment);
        break;
      }

      case "transfer.success": {
        const transferCode = data?.transfer_code;
        if (!transferCode) return;
        await pharmacyPaymentService.handleTransferSuccess(transferCode);
        break;
      }

      case "transfer.failed":
      case "transfer.reversed": {
        const transferCode = data?.transfer_code;
        const reason       = data?.gateway_response || event;
        if (!transferCode) return;
        await pharmacyPaymentService.handleTransferFailed(transferCode, reason);
        break;
      }

      default:
        console.log(`[PharmacyWebhook] Unhandled Paystack event: ${event}`);
    }
  },

  _handleFlutterwave: async (body) => {
    const event = body.event;
    const data  = body.data;

    console.log(`[PharmacyWebhook] Flutterwave event: ${event}`);

    switch (event) {
      case "charge.completed": {
        if (data?.status !== "successful") return;

        const reference = data?.tx_ref;
        const meta      = data?.meta;

        if (!reference) {
          console.warn("[PharmacyWebhook] charge.completed: missing tx_ref");
          return;
        }

        // Route to patient wallet top-up handler if applicable
        if (meta?.type === "wallet_topup") {
          await patientWalletService.handleTopUpSuccess(reference);
          break;
        }

        // Route to prescription cart payment handler
        if (meta?.type === "prescription_cart") {
          await pharmacySessionService.handleCartPaymentSuccess(meta.cartId);
          break;
        }

        if (!meta?.invoiceId) {
          console.warn("[PharmacyWebhook] charge.completed: missing invoiceId in meta");
          return;
        }

        const payment = await pharmacyPaymentRepo.findByReference(reference);
        await pharmacyPaymentService.handlePaymentSuccess(meta.invoiceId, payment);
        break;
      }

      case "transfer.completed": {
        if (data?.status !== "SUCCESSFUL") return;
        const reference = data?.reference;
        if (!reference) return;
        // Flutterwave uses reference not transfer_code — find payout by reference
        const { AppDataSource } = require("../../../config/database");
        const payout = await AppDataSource.getRepository("PharmacyPayoutRequest").findOne({
          where: { reference },
        });
        if (payout?.transferCode) {
          await pharmacyPaymentService.handleTransferSuccess(payout.transferCode);
        }
        break;
      }

      default:
        console.log(`[PharmacyWebhook] Unhandled Flutterwave event: ${event}`);
    }
  },
};

module.exports = pharmacyWebhookController;
