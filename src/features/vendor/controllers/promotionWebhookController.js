const crypto           = require("crypto");
const promotionService = require("../services/promotionService");

class PromotionWebhookController {
    async handlePaystack(req, res) {
        const secret    = process.env.PAYSTACK_SECRET_KEY;
        const signature = req.headers["x-paystack-signature"];
        const hash      = crypto.createHmac("sha512", secret).update(req.rawBody).digest("hex");

        if (hash !== signature) {
            return res.status(401).json({ error: "Invalid signature" });
        }

        const { event, data } = req.body;

        if (event === "charge.success") {
            try {
                const reference = data?.reference;
                if (!reference) return res.sendStatus(400);

                await promotionService.activatePromotion(reference);
            } catch (err) {
                // Log but always return 200 so Paystack doesn't retry
                console.error("Promotion Paystack webhook error:", err.message);
            }
        }

        return res.sendStatus(200);
    }

    async handleFlutterwave(req, res) {
        const secret    = process.env.FLUTTERWAVE_SECRET_KEY;
        const signature = req.headers["verif-hash"];

        if (signature !== secret) {
            return res.status(401).json({ error: "Invalid signature" });
        }

        const { event, data } = req.body;

        if (event === "charge.completed" && data?.status === "successful") {
            try {
                const reference = data?.tx_ref;
                if (!reference) return res.sendStatus(400);

                await promotionService.activatePromotion(reference);
            } catch (err) {
                console.error("Promotion Flutterwave webhook error:", err.message);
            }
        }

        return res.sendStatus(200);
    }
}

module.exports = new PromotionWebhookController();
