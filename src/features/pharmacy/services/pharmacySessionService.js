const axios               = require("axios");
const AppDataSource       = require("../../../config/database");
const sessionRepository   = require("../repositories/sessionRepository");
const cartRepository      = require("../repositories/prescriptionCartRepository");
const { getIO }           = require("../../../config/websocket");
const NotificationService = require("../../notifications/services/notificationService");
const CurrencyService     = require("../../payments/services/currencyService");

const notificationService = new NotificationService();

// Pharmacies are EXEMPT from platform fee and commission.
// No platform fee is added to prescription cart payments.
const SESSION_TIMEOUT_MINUTES = parseInt(process.env.SESSION_TIMEOUT_MINUTES || "30", 10);

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildExpiresAt() {
    const d = new Date();
    d.setMinutes(d.getMinutes() + SESSION_TIMEOUT_MINUTES);
    return d;
}

function emitToPatient(patientId, event, data) {
    try { getIO().to(`user_${patientId}`).emit(event, data); } catch { /* non-critical */ }
}

function emitToPharmacy(pharmacyId, event, data) {
    try { getIO().to(`pharmacy_${pharmacyId}`).emit(event, data); } catch { /* non-critical */ }
}

function formatCart(cart) {
    if (!cart) return null;
    return {
        id:               cart.id,
        sessionId:        cart.sessionId,
        status:           cart.status,
        pharmacyNote:     cart.pharmacyNote || null,
        totalAmountNgn:   cart.totalAmountNgn   ? parseFloat(cart.totalAmountNgn)   : null,
        platformFeeNgn:   cart.platformFeeNgn   ? parseFloat(cart.platformFeeNgn)   : null,
        pharmacyAmountNgn: cart.pharmacyAmountNgn ? parseFloat(cart.pharmacyAmountNgn) : null,
        currency:         cart.currency,
        paymentStatus:    cart.paymentStatus,
        paymentAuthUrl:   cart.paymentAuthUrl || null,
        paidAt:           cart.paidAt || null,
        items: (cart.items || []).map((i) => ({
            id:            i.id,
            productName:   i.productName,
            quantity:      i.quantity,
            unitPriceNgn:  parseFloat(i.unitPriceNgn),
            totalPriceNgn: parseFloat(i.totalPriceNgn),
            note:          i.note || null,
            isSubstitute:  i.isSubstitute,
        })),
    };
}

function formatSession(session) {
    return {
        id:             session.id,
        prescriptionId: session.prescriptionId,
        pharmacyId:     session.pharmacyId,
        patientId:      session.patientId,
        status:         session.status,
        expiresAt:      session.expiresAt,
        isExpired:      new Date() > new Date(session.expiresAt),
        cart:           formatCart(session.cart),
        createdAt:      session.createdAt,
        updatedAt:      session.updatedAt,
    };
}

// ─── expiry helper ─────────────────────────────────────────────────────────────

async function expireIfNeeded(session) {
    if (session.status === "active" && new Date() > new Date(session.expiresAt)) {
        await sessionRepository.update(session.id, { status: "expired" });
        session.status = "expired";

        emitToPatient(session.patientId, "prescription_session_expired", {
            sessionId:      session.id,
            prescriptionId: session.prescriptionId,
            pharmacyId:     session.pharmacyId,
        });
        emitToPharmacy(session.pharmacyId, "prescription_session_expired", {
            sessionId:      session.id,
            prescriptionId: session.prescriptionId,
            patientId:      session.patientId,
        });

        try {
            await notificationService.createNotification(
                session.patientId, "alert",
                "Your pharmacy session has expired. You can start a new session with the same or a different pharmacy.",
                { sessionId: session.id, prescriptionId: session.prescriptionId }
            );
        } catch { /* non-critical */ }
    }
    return session;
}

// ─── service ──────────────────────────────────────────────────────────────────

class PharmacySessionService {

    // ─── PATIENT: start session ───────────────────────────────────────────────

    async startSession(patientId, { prescriptionId, pharmacyId }) {
        if (!prescriptionId || !pharmacyId) {
            throw new Error("prescriptionId and pharmacyId are required");
        }

        // Validate prescription belongs to patient
        const prescription = await AppDataSource.getRepository("Prescription").findOne({
            where: { id: prescriptionId, patientId },
        });
        if (!prescription) throw new Error("Prescription not found");

        // Prevent duplicate active sessions with the same pharmacy
        const existing = await sessionRepository.findExisting(prescriptionId, pharmacyId, patientId);
        if (existing) throw new Error("You already have an active session with this pharmacy for this prescription");

        const session = await sessionRepository.save({
            prescriptionId,
            pharmacyId,
            patientId,
            status:    "active",
            expiresAt: buildExpiresAt(),
        });

        // Create empty prescription cart immediately
        const cart = await cartRepository.save({
            sessionId:      session.id,
            prescriptionId,
            pharmacyId,
            patientId,
            status:         "building",
            paymentStatus:  "unpaid",
            currency:       "NGN",
        });

        // Notify pharmacy in real-time
        emitToPharmacy(pharmacyId, "prescription_session_started", {
            sessionId:      session.id,
            prescriptionId,
            patientId,
            expiresAt:      session.expiresAt,
        });

        try {
            await notificationService.createNotification(
                pharmacyId, "notification",
                "A patient has started a prescription session. Please review the prescription and add items to their cart.",
                { sessionId: session.id, prescriptionId }
            );
        } catch { /* non-critical */ }

        const full = await sessionRepository.findById(session.id);
        return formatSession(full);
    }

    // ─── PATIENT: list sessions ───────────────────────────────────────────────

    async getPatientSessions(patientId, { status, page, limit }) {
        const result = await sessionRepository.findByPatientPaginated({
            patientId, status,
            page:  Number(page  || 1),
            limit: Number(limit || 20),
        });

        // Lazily expire any stale sessions
        for (const s of result.sessions) {
            await expireIfNeeded(s);
        }

        return { ...result, sessions: result.sessions.map(formatSession) };
    }

    async getPatientSessionById(patientId, sessionId) {
        const session = await sessionRepository.findByIdAndPatient(sessionId, patientId);
        if (!session) throw new Error("Session not found");
        await expireIfNeeded(session);
        return formatSession(session);
    }

    // ─── PATIENT: approve cart and initiate payment ───────────────────────────

    async approveAndPay(patientId, sessionId) {
        const session = await sessionRepository.findByIdAndPatient(sessionId, patientId);
        if (!session) throw new Error("Session not found");
        await expireIfNeeded(session);
        if (session.status === "expired") throw new Error("Session has expired. Please start a new session.");
        if (session.status !== "cart_ready") throw new Error("Cart is not ready for payment yet. Wait for the pharmacy to finalise.");
        if (session.status === "approved")  throw new Error("Session is already approved and paid.");

        const cart = session.cart;
        if (!cart || !cart.totalAmountNgn) throw new Error("Cart has no items or total");
        if (cart.paymentStatus === "paid") throw new Error("Cart has already been paid");

        // Get payment URL (or return existing one if already initiated)
        if (cart.paymentAuthUrl && cart.paymentStatus === "unpaid") {
            const grossAmount = parseFloat(cart.totalAmountNgn) + parseFloat(cart.platformFeeNgn || 0);
            return {
                paymentUrl:        cart.paymentAuthUrl,
                reference:         cart.paymentReference,
                amount:            parseFloat(cart.totalAmountNgn), // pharmacy's base
                platformFeeAmount: parseFloat(cart.platformFeeNgn || 0),
                grossAmount,       // what patient pays
                currency:          cart.currency,
                sessionId,
            };
        }

        return this._initiateCartPayment(patientId, session, cart);
    }

    async _initiateCartPayment(patientId, session, cart) {
        const patient = await AppDataSource.getRepository("User").findOne({ where: { id: patientId } });
        // Patient pays base + 7% platform fee on top
        // Pharmacy still receives the base amount (cart total) — fee goes to platform
        const rates          = await CurrencyService.getExchangeRates();
        const ngnRate        = rates?.NGN || 1500; // fallback NGN per USD
        const amountNgn      = parseFloat(cart.totalAmountNgn);      // pharmacy's base
        const platformFeeNgn = parseFloat(cart.platformFeeNgn || 0); // 7% on top
        const grossAmountNgn = parseFloat((amountNgn + platformFeeNgn).toFixed(4)); // patient pays this
        const amountUsd      = parseFloat((amountNgn / ngnRate).toFixed(6));        // pharmacy receives base in USD

        const reference = `COSMIC-RX-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const provider  = process.env.DEFAULT_PAYMENT_PROVIDER || "paystack";

        let authUrl;
        const metadata = {
            type:           "prescription_cart",
            cartId:         cart.id,
            sessionId:      session.id,
            prescriptionId: session.prescriptionId,
            pharmacyId:     session.pharmacyId,
            patientId,
        };

        if (provider === "flutterwave") {
            const resp = await axios.post(
                "https://api.flutterwave.com/v3/payments",
                {
                    tx_ref:       reference,
                    amount:       grossAmountNgn, // base + 7% platform fee
                    currency:     "NGN",
                    redirect_url: process.env.PAYMENT_CALLBACK_URL,
                    customer:     { email: patient.email, name: patient.fullName },
                    meta:         metadata,
                },
                { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
            );
            authUrl = resp.data.data.link;
        } else {
            const resp = await axios.post(
                "https://api.paystack.co/transaction/initialize",
                {
                    email:        patient.email,
                    amount:       Math.round(grossAmountNgn * 100), // base + 7% platform fee (kobo)
                    currency:     "NGN",
                    reference,
                    metadata,
                    callback_url: process.env.PAYMENT_CALLBACK_URL,
                },
                { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
            );
            authUrl = resp.data.data.authorization_url;
        }

        // Pharmacy receives base amount (totalAmountNgn converted to USD)
        // Platform fee (7%) goes to platform — patient paid it on top
        const platformFeeUsd    = parseFloat((platformFeeNgn / ngnRate).toFixed(6));
        await cartRepository.update(cart.id, {
            paymentReference:  reference,
            paymentProvider:   provider,
            paymentAuthUrl:    authUrl,
            totalAmountUsd:    amountUsd,         // base amount pharmacy receives
            platformFeeUsd,                        // 7% platform revenue
            pharmacyAmountUsd: amountUsd,          // pharmacy gets full base
            exchangeRateToUsd: parseFloat((1 / ngnRate).toFixed(6)),
        });

        return {
            paymentUrl:        authUrl,
            reference,
            amount:            amountNgn,      // pharmacy's base price
            platformFeeAmount: platformFeeNgn, // 7% on top
            grossAmount:       grossAmountNgn, // what patient pays
            currency:          "NGN",
            sessionId:         session.id,
        };
    }

    // ─── PATIENT: cancel session ──────────────────────────────────────────────

    async cancelSession(patientId, sessionId) {
        const session = await sessionRepository.findByIdAndPatient(sessionId, patientId);
        if (!session) throw new Error("Session not found");
        if (["approved", "cancelled", "expired"].includes(session.status)) {
            throw new Error(`Session cannot be cancelled — current status: ${session.status}`);
        }
        if (session.cart?.paymentStatus === "paid") {
            throw new Error("Cannot cancel a paid session. Raise a dispute instead.");
        }

        await sessionRepository.update(sessionId, { status: "cancelled" });

        emitToPharmacy(session.pharmacyId, "prescription_session_cancelled", {
            sessionId, prescriptionId: session.prescriptionId, cancelledBy: "patient",
        });

        try {
            await notificationService.createNotification(
                session.pharmacyId, "alert",
                "A patient has cancelled their prescription session.",
                { sessionId, prescriptionId: session.prescriptionId }
            );
        } catch { /* non-critical */ }

        const updated = await sessionRepository.findByIdAndPatient(sessionId, patientId);
        return formatSession(updated);
    }

    // ─── PHARMACY: list sessions ──────────────────────────────────────────────

    async getPharmacySessions(pharmacyId, { status, page, limit }) {
        const result = await sessionRepository.findByPharmacyPaginated({
            pharmacyId, status,
            page:  Number(page  || 1),
            limit: Number(limit || 20),
        });

        for (const s of result.sessions) {
            await expireIfNeeded(s);
        }

        return { ...result, sessions: result.sessions.map(formatSession) };
    }

    async getPharmacySessionById(pharmacyId, sessionId) {
        const session = await sessionRepository.findByIdAndPharmacy(sessionId, pharmacyId);
        if (!session) throw new Error("Session not found");
        await expireIfNeeded(session);
        return formatSession(session);
    }

    // ─── PHARMACY: add item to prescription cart ──────────────────────────────

    async addCartItem(pharmacyId, sessionId, { productName, quantity, unitPriceNgn, note, isSubstitute }) {
        if (!productName || !unitPriceNgn || !quantity) {
            throw new Error("productName, quantity, and unitPriceNgn are required");
        }
        if (quantity < 1)      throw new Error("quantity must be at least 1");
        if (unitPriceNgn <= 0) throw new Error("unitPriceNgn must be greater than 0");

        const session = await sessionRepository.findByIdAndPharmacy(sessionId, pharmacyId);
        if (!session) throw new Error("Session not found");
        await expireIfNeeded(session);
        if (session.status !== "active") throw new Error("Can only add items to an active session");

        const cart = session.cart;
        const totalPriceNgn = parseFloat((unitPriceNgn * quantity).toFixed(4));

        await cartRepository.saveItem({
            cartId:       cart.id,
            productName,
            quantity,
            unitPriceNgn: parseFloat(Number(unitPriceNgn).toFixed(4)),
            totalPriceNgn,
            note:         note || null,
            isSubstitute: isSubstitute === true,
        });

        // Recalculate cart total
        await this._recalculateCartTotal(cart.id);

        const updatedCart = await cartRepository.findBySessionId(sessionId);

        // Real-time sync to patient
        emitToPatient(session.patientId, "prescription_cart_item_added", {
            sessionId,
            cart: formatCart(updatedCart),
        });

        return formatCart(updatedCart);
    }

    // ─── PHARMACY: remove item from prescription cart ─────────────────────────

    async removeCartItem(pharmacyId, sessionId, itemId) {
        const session = await sessionRepository.findByIdAndPharmacy(sessionId, pharmacyId);
        if (!session) throw new Error("Session not found");
        await expireIfNeeded(session);
        if (session.status !== "active") throw new Error("Can only modify items in an active session");

        const item = await cartRepository.findItemById(itemId);
        if (!item || item.cartId !== session.cart.id) throw new Error("Item not found");

        await cartRepository.deleteItem(itemId);
        await this._recalculateCartTotal(session.cart.id);

        const updatedCart = await cartRepository.findBySessionId(sessionId);

        emitToPatient(session.patientId, "prescription_cart_item_removed", {
            sessionId,
            cart: formatCart(updatedCart),
        });

        return formatCart(updatedCart);
    }

    // ─── PHARMACY: finalise cart (mark as ready for patient) ─────────────────

    async finaliseCart(pharmacyId, sessionId, { pharmacyNote } = {}) {
        const session = await sessionRepository.findByIdAndPharmacy(sessionId, pharmacyId);
        if (!session) throw new Error("Session not found");
        await expireIfNeeded(session);
        if (session.status !== "active") throw new Error("Session is no longer active");

        const cart = await cartRepository.findBySessionId(sessionId);
        if (!cart || !cart.items || cart.items.length === 0) {
            throw new Error("Cart must have at least one item before finalising");
        }

        await cartRepository.update(cart.id, {
            status:       "ready",
            pharmacyNote: pharmacyNote || null,
        });
        await sessionRepository.update(sessionId, { status: "cart_ready" });

        const updatedCart = await cartRepository.findBySessionId(sessionId);

        // Real-time notify patient
        emitToPatient(session.patientId, "prescription_cart_ready", {
            sessionId,
            prescriptionId: session.prescriptionId,
            cart:           formatCart(updatedCart),
        });

        try {
            await notificationService.createNotification(
                session.patientId, "notification",
                "Your prescription cart is ready. Review it and proceed to payment.",
                { sessionId, prescriptionId: session.prescriptionId }
            );
        } catch { /* non-critical */ }

        const updated = await sessionRepository.findByIdAndPharmacy(sessionId, pharmacyId);
        return formatSession(updated);
    }

    // ─── PHARMACY: cancel session ─────────────────────────────────────────────

    async cancelSessionByPharmacy(pharmacyId, sessionId) {
        const session = await sessionRepository.findByIdAndPharmacy(sessionId, pharmacyId);
        if (!session) throw new Error("Session not found");
        if (["approved", "cancelled", "expired"].includes(session.status)) {
            throw new Error(`Session cannot be cancelled — current status: ${session.status}`);
        }

        await sessionRepository.update(sessionId, { status: "cancelled" });

        emitToPatient(session.patientId, "prescription_session_cancelled", {
            sessionId, prescriptionId: session.prescriptionId, cancelledBy: "pharmacy",
        });

        try {
            await notificationService.createNotification(
                session.patientId, "alert",
                "A pharmacy has cancelled your prescription session. You can start a new session with another pharmacy.",
                { sessionId, prescriptionId: session.prescriptionId }
            );
        } catch { /* non-critical */ }

        const updated = await sessionRepository.findByIdAndPharmacy(sessionId, pharmacyId);
        return formatSession(updated);
    }

    // ─── WEBHOOK: payment confirmed ───────────────────────────────────────────

    async handleCartPaymentSuccess(cartId) {
        const cart = await cartRepository.findBySessionId(
            (await AppDataSource.getRepository("PrescriptionCart").findOne({ where: { id: cartId } }))?.sessionId
        );
        if (!cart) throw new Error("Prescription cart not found");
        if (cart.paymentStatus === "paid") return; // idempotent

        const session = await sessionRepository.findById(
            (await AppDataSource.getRepository("PharmacySession").findOne({ where: { id: cart.sessionId } }))?.id
        );

        await AppDataSource.transaction(async (trx) => {
            // Mark cart paid
            await trx.update("PrescriptionCart", { id: cart.id }, {
                paymentStatus: "paid",
                status:        "approved",
                paidAt:        new Date(),
            });

            // Mark session approved
            await trx.update("PharmacySession", { id: cart.sessionId }, { status: "approved" });

            // Move prescription to in_progress
            await trx.update("Prescription", { id: cart.prescriptionId }, {
                status:        "in_progress",
                paymentStatus: "paid",
                paymentMethod: "online",
            });

            // Pharmacy is exempt — credit 100% of cart amount to wallet (no deduction)
            const pharmacyAmountUsd = parseFloat(cart.totalAmountUsd || cart.pharmacyAmountUsd || 0);
            if (pharmacyAmountUsd > 0) {
                const wallet = await trx.findOne("PharmacyWallet", { where: { pharmacyId: cart.pharmacyId } });
                if (wallet) {
                    await trx.update("PharmacyWallet", { id: wallet.id }, {
                        pendingClearanceUsd: parseFloat(wallet.pendingClearanceUsd || 0) + pharmacyAmountUsd,
                        totalEarningsUsd:    parseFloat(wallet.totalEarningsUsd    || 0) + pharmacyAmountUsd,
                    });

                    await trx.save("PharmacyWalletTransaction", {
                        walletId:    wallet.id,
                        pharmacyId:  cart.pharmacyId,
                        type:        "credit",
                        category:    "invoice_payment",
                        status:      "pending",
                        amountUsd:   pharmacyAmountUsd,
                        description: `Prescription cart payment — session ${cart.sessionId} (7% platform fee deducted)`,
                        reference:   cart.paymentReference,
                    });
                }
            }

            // Cancel all other active sessions for this prescription
            await trx.createQueryBuilder()
                .update("PharmacySession")
                .set({ status: "cancelled" })
                .where("prescriptionId = :prescriptionId AND id != :sessionId AND status IN ('active','cart_ready')", {
                    prescriptionId: cart.prescriptionId,
                    sessionId:      cart.sessionId,
                })
                .execute();
        });

        // Real-time events
        emitToPharmacy(cart.pharmacyId, "prescription_session_approved", {
            sessionId: cart.sessionId, prescriptionId: cart.prescriptionId,
        });
        emitToPatient(cart.patientId, "prescription_session_approved", {
            sessionId: cart.sessionId, prescriptionId: cart.prescriptionId,
        });

        try {
            await notificationService.createNotification(
                cart.pharmacyId, "success",
                "Payment received for prescription cart. Please fulfil the order.",
                { sessionId: cart.sessionId, prescriptionId: cart.prescriptionId }
            );
        } catch { /* non-critical */ }
    }

    // ─── Internal: recalculate total from items ───────────────────────────────

    async _recalculateCartTotal(cartId) {
        const items = await AppDataSource.getRepository("PrescriptionCartItem").find({ where: { cartId } });
        const total = items.reduce((sum, i) => sum + parseFloat(i.totalPriceNgn), 0);

        // Platform fee added ON TOP — patient pays base + fee
        // Pharmacy receives full base amount (exempt from commission, not from platform fee)
        const platformConfigService = require("../../admin-ops/services/platformConfigService");
        const PLATFORM_FEE_RATE     = await platformConfigService.getPlatformFeeRate();
        const platformFee           = parseFloat((total * PLATFORM_FEE_RATE).toFixed(4));

        await cartRepository.update(cartId, {
            totalAmountNgn:    parseFloat(total.toFixed(4)),  // pharmacy's base price
            platformFeeNgn:    platformFee,                    // 7% added on top for patient
            pharmacyAmountNgn: parseFloat(total.toFixed(4)), // pharmacy receives full base
        });
    }
}

module.exports = new PharmacySessionService();
