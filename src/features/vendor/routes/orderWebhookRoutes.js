const router       = require("express").Router();
const orderService = require("../services/orderService");
const crypto       = require("crypto");

// Paystack sends raw body — verify signature then process
router.post("/", async (req, res) => {
    const secret    = process.env.PAYSTACK_SECRET_KEY;
    const signature = req.headers["x-paystack-signature"];

    if (secret && signature) {
        const hash = crypto
            .createHmac("sha512", secret)
            .update(req.rawBody || JSON.stringify(req.body))
            .digest("hex");

        if (hash !== signature) {
            return res.status(401).json({ error: "Invalid signature" });
        }
    }

    const { event, data } = req.body;

    try {
        if (event === "charge.success") {
            const meta = data.metadata || {};
            if (meta.type === "vendor_order") {
                await orderService.handlePaymentSuccess(data.reference);
            }
        }
        return res.status(200).json({ received: true });
    } catch (error) {
        console.error("[VendorOrderWebhook] Error:", error.message);
        return res.status(200).json({ received: true }); // always 200 to Paystack
    }
});

module.exports = router;
