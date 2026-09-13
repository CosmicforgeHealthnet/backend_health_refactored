const sessionService         = require("../services/pharmacySessionService");
const pharmacyProfileRepo    = require("../repositories/pharmacyProfileRepository");

async function resolvePharmacyId(userId) {
    const profile = await pharmacyProfileRepo.findByUserId(userId);
    if (!profile) throw Object.assign(new Error("Pharmacy profile not found"), { status: 403 });
    return profile.id;
}

function isClientError(msg) {
    return (
        msg.includes("not found") ||
        msg.includes("required") ||
        msg.includes("already") ||
        msg.includes("Cannot") ||
        // BUG FIX: pharmacySessionService throws "Can only add items to an
        // active session" and "Can only modify items in an active session"
        // (addCartItem/removeCartItem) — neither matched any pattern here
        // (note the capital-C "Cannot" above is a different string), so both
        // fell through to next(error) and surfaced as a 500 instead of the
        // intended 400. Same class of bug as the promotionWebhookController
        // isClientError mismatch found in the vendor feature.
        msg.includes("Can only") ||
        msg.includes("must be") ||
        msg.includes("expired") ||
        msg.includes("cannot be cancelled") ||
        msg.includes("at least") ||
        msg.includes("greater than") ||
        msg.includes("no longer") ||
        // BUG FIX: approveAndPay's "Cart has no items or total" also matched
        // nothing above, so a cart missing its total fell through to a 500
        // instead of 400.
        msg.includes("no items") ||
        msg.includes("ready") ||
        msg.includes("approved") ||
        msg.includes("dispute")
    );
}

class PharmacySessionController {

    // ─── Patient ──────────────────────────────────────────────────────────────

    async startSession(req, res, next) {
        try {
            const session = await sessionService.startSession(req.user.id, req.body);
            return res.status(201).json({
                success: true,
                message: `Session started. The pharmacy has ${process.env.SESSION_TIMEOUT_MINUTES || 30} minutes to build your cart.`,
                session,
            });
        } catch (error) {
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async getPatientSessions(req, res, next) {
        try {
            const { status, page, limit } = req.query;
            const result = await sessionService.getPatientSessions(req.user.id, { status, page, limit });
            return res.status(200).json({ success: true, ...result });
        } catch (error) {
            next(error);
        }
    }

    async getPatientSessionById(req, res, next) {
        try {
            const session = await sessionService.getPatientSessionById(req.user.id, req.params.sessionId);
            return res.status(200).json({ success: true, session });
        } catch (error) {
            if (isClientError(error.message)) return res.status(404).json({ success: false, error: error.message });
            next(error);
        }
    }

    async approveAndPay(req, res, next) {
        try {
            const result = await sessionService.approveAndPay(req.user.id, req.params.sessionId);
            return res.status(200).json({
                success: true,
                message: "Proceed to the payment URL to complete your purchase.",
                ...result,
            });
        } catch (error) {
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async cancelSession(req, res, next) {
        try {
            const session = await sessionService.cancelSession(req.user.id, req.params.sessionId);
            return res.status(200).json({ success: true, message: "Session cancelled", session });
        } catch (error) {
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    // ─── Pharmacy ─────────────────────────────────────────────────────────────

    async getPharmacySessions(req, res, next) {
        try {
            const pharmacyId = await resolvePharmacyId(req.user.id);
            const { status, page, limit } = req.query;
            const result = await sessionService.getPharmacySessions(pharmacyId, { status, page, limit });
            return res.status(200).json({ success: true, ...result });
        } catch (error) {
            if (error.status === 403) return res.status(403).json({ success: false, error: error.message });
            next(error);
        }
    }

    async getPharmacySessionById(req, res, next) {
        try {
            const pharmacyId = await resolvePharmacyId(req.user.id);
            const session = await sessionService.getPharmacySessionById(pharmacyId, req.params.sessionId);
            return res.status(200).json({ success: true, session });
        } catch (error) {
            if (error.status === 403) return res.status(403).json({ success: false, error: error.message });
            if (isClientError(error.message)) return res.status(404).json({ success: false, error: error.message });
            next(error);
        }
    }

    async addCartItem(req, res, next) {
        try {
            const pharmacyId = await resolvePharmacyId(req.user.id);
            const cart = await sessionService.addCartItem(pharmacyId, req.params.sessionId, req.body);
            return res.status(200).json({ success: true, message: "Item added to cart", cart });
        } catch (error) {
            if (error.status === 403) return res.status(403).json({ success: false, error: error.message });
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async removeCartItem(req, res, next) {
        try {
            const pharmacyId = await resolvePharmacyId(req.user.id);
            const cart = await sessionService.removeCartItem(pharmacyId, req.params.sessionId, req.params.itemId);
            return res.status(200).json({ success: true, message: "Item removed", cart });
        } catch (error) {
            if (error.status === 403) return res.status(403).json({ success: false, error: error.message });
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async finaliseCart(req, res, next) {
        try {
            const pharmacyId = await resolvePharmacyId(req.user.id);
            const session = await sessionService.finaliseCart(pharmacyId, req.params.sessionId, req.body);
            return res.status(200).json({
                success: true,
                message: "Cart finalised. The patient has been notified and can now proceed to payment.",
                session,
            });
        } catch (error) {
            if (error.status === 403) return res.status(403).json({ success: false, error: error.message });
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async cancelSessionByPharmacy(req, res, next) {
        try {
            const pharmacyId = await resolvePharmacyId(req.user.id);
            const session = await sessionService.cancelSessionByPharmacy(pharmacyId, req.params.sessionId);
            return res.status(200).json({ success: true, message: "Session cancelled", session });
        } catch (error) {
            if (error.status === 403) return res.status(403).json({ success: false, error: error.message });
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }
}

module.exports = new PharmacySessionController();
