const express               = require("express");
const router                = express.Router();
const crypto                = require("node:crypto");
const pharmacyWebhookCtrl   = require("../controllers/pharmacyWebhookController");

// ─── Signature verification ──────────────────────────────────────────────────

const verifyPaystackSignature = (req, res, next) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    const secret    = process.env.PAYSTACK_SECRET_KEY;

    if (!secret) {
      console.warn("[PharmacyWebhook] PAYSTACK_SECRET_KEY not set — allowing all (dev only)");
      req.params.provider = "paystack";
      return next();
    }

    if (!signature) {
      return res.status(401).json({ error: "Missing Paystack signature" });
    }

    if (!req.rawBody) {
      return res.status(500).json({ error: "rawBody not captured" });
    }

    const hash = crypto
      .createHmac("sha512", secret)
      .update(req.rawBody, "utf8")
      .digest("hex");

    if (hash !== signature) {
      return res.status(401).json({ error: "Invalid Paystack signature" });
    }

    req.params.provider = "paystack";
    next();
  } catch (err) {
    console.error("[PharmacyWebhook] Paystack signature error:", err.message);
    res.status(401).json({ error: "Unauthorized" });
  }
};

const verifyFlutterwaveSignature = (req, res, next) => {
  try {
    const signature  = req.headers["verif-hash"];
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;

    if (!secretHash) {
      console.warn("[PharmacyWebhook] FLUTTERWAVE_SECRET_HASH not set — allowing all (dev only)");
      req.params.provider = "flutterwave";
      return next();
    }

    if (!signature || signature !== secretHash) {
      return res.status(401).json({ error: "Invalid Flutterwave signature" });
    }

    req.params.provider = "flutterwave";
    next();
  } catch (err) {
    console.error("[PharmacyWebhook] Flutterwave signature error:", err.message);
    res.status(401).json({ error: "Unauthorized" });
  }
};

const routeByProvider = (req, res, next) => {
  if (req.params.provider === "flutterwave") return verifyFlutterwaveSignature(req, res, next);
  if (req.params.provider === "paystack")    return verifyPaystackSignature(req, res, next);
  return res.status(400).json({ error: "Unknown provider" });
};

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/webhooks/pharmacy/:provider
 * @desc    Receive Paystack or Flutterwave webhook events for pharmacy payments
 * @access  Internal (gateway only — verified by signature)
 */
router.post("/:provider", routeByProvider, pharmacyWebhookCtrl.handleWebhook);

module.exports = router;
