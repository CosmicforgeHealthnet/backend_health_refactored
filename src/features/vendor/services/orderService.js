const axios               = require("axios");
const AppDataSource       = require("../../../config/database");
const orderRepository     = require("../repositories/orderRepository");
const vendorRepository    = require("../repositories/vendorRepository");
const cartRepository      = require("../../cart/repositories/cartRepository");
const userRepository      = require("../../auth/repositories/userRepository");
const walletService         = require("./walletService");
const NotificationService   = require("../../notifications/services/notificationService");
const platformConfigService = require("../../admin-ops/services/platformConfigService");

const notificationService = new NotificationService();

function generateOrderNumber() {
    const seq = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${Date.now()}-${seq}`;
}

class OrderService {

    // ─── Patient: checkout a confirmed cart ──────────────────────────────────

    async initiateCheckout(patientId, cartId) {
        const cart = await cartRepository.findByIdAndPatient(cartId, patientId);
        if (!cart) throw new Error("Cart not found");
        if (cart.status !== "confirmed") throw new Error("Cart must be confirmed by the vendor before checkout");

        const existing = await orderRepository.findByCartId(cartId);
        if (existing) {
            if (existing.paymentStatus === "paid") throw new Error("This cart has already been paid");
            // Return existing unpaid order so patient can retry payment
            return this._buildCheckoutResponse(existing);
        }

        const subtotal = parseFloat(cart.confirmedTotal);

        // Read rates from admin-controlled config (cached, 5-min TTL)
        const PLATFORM_FEE_RATE      = await platformConfigService.getPlatformFeeRate();
        const VENDOR_COMMISSION_RATE = await platformConfigService.getVendorCommissionRate();

        // Platform fee added ON TOP — customer pays it, vendor is NOT deducted
        const platformFeeAmount = parseFloat((subtotal * PLATFORM_FEE_RATE).toFixed(4));
        const grossAmount       = parseFloat((subtotal + platformFeeAmount).toFixed(4)); // customer pays this
        // Vendor commission deducted from vendor earnings
        const commissionRate    = VENDOR_COMMISSION_RATE;
        const commissionAmount  = parseFloat((subtotal * commissionRate).toFixed(4));
        const vendorAmount      = parseFloat((subtotal - commissionAmount).toFixed(4)); // vendor receives this

        const order = await orderRepository.save({
            orderNumber:       generateOrderNumber(),
            cartId:            cart.id,
            vendorId:          cart.vendorId,
            patientId,
            status:            "pending",
            paymentStatus:     "unpaid",
            subtotal,
            platformFeeAmount,
            grossAmount,
            commissionRate,
            commissionAmount,
            vendorAmount,
            currency:          "NGN",
            patientNote:       cart.patientNote || null,
            vendorNote:        cart.vendorNote  || null,
        });

        return this._buildCheckoutResponse(order);
    }

    async initiatePayment(patientId, orderId) {
        const order = await orderRepository.findById(orderId);
        if (!order) throw new Error("Order not found");
        if (order.patientId !== patientId) throw new Error("Order not found");
        if (order.paymentStatus === "paid") throw new Error("Order has already been paid");

        const user      = await userRepository.findById(patientId);
        const reference = `COSMIC-ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        // Charge grossAmount (subtotal + 7% platform fee) — not subtotal alone
        const amount    = parseFloat(order.grossAmount || order.subtotal);

        const provider = process.env.DEFAULT_PAYMENT_PROVIDER || "paystack";
        let authUrl;

        if (provider === "flutterwave") {
            const response = await axios.post(
                "https://api.flutterwave.com/v3/payments",
                {
                    tx_ref:       reference,
                    amount,
                    currency:     order.currency,
                    redirect_url: process.env.PAYMENT_CALLBACK_URL,
                    customer:     { email: user.email, name: user.fullName },
                    meta:         { orderId: order.id, vendorId: order.vendorId, type: "vendor_order" },
                },
                { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
            );
            authUrl = response.data.data.link;
        } else {
            const response = await axios.post(
                "https://api.paystack.co/transaction/initialize",
                {
                    email:        user.email,
                    amount:       Math.round(amount * 100),
                    currency:     order.currency,
                    reference,
                    metadata:     { orderId: order.id, vendorId: order.vendorId, type: "vendor_order" },
                    callback_url: process.env.PAYMENT_CALLBACK_URL,
                },
                { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
            );
            authUrl = response.data.data.authorization_url;
        }

        await orderRepository.update(order.id, {
            paymentReference: reference,
            paymentProvider:  provider,
            paymentAuthUrl:   authUrl,
        });

        return { paymentUrl: authUrl, reference, amount, orderId: order.id };
    }

    // ─── Webhook: payment confirmed ──────────────────────────────────────────

    async handlePaymentSuccess(paymentReference) {
        const order = await orderRepository.findByPaymentReference(paymentReference);
        if (!order) throw new Error("Order not found for payment reference");
        if (order.paymentStatus === "paid") return order; // idempotent

        await orderRepository.update(order.id, {
            paymentStatus: "paid",
            status:        "processing",
            paidAt:        new Date(),
        });

        // Deduct inventory for each cart item
        await this._deductInventory(order.cartId);

        // Credit vendor wallet (93% of subtotal)
        await walletService.creditOrder(order.vendorId, {
            orderId:    order.id,
            amountNgn:  parseFloat(order.vendorAmount),
            reference:  paymentReference,
            description: `Order payment — ${order.orderNumber} (platform fee deducted)`,
        });

        // Notify vendor
        try {
            await notificationService.createNotification(
                order.vendorId,
                "success",
                `Payment received for order ${order.orderNumber}. Please process and fulfil the order.`,
                { orderId: order.id }
            );
        } catch { /* non-critical */ }

        // Notify patient
        try {
            await notificationService.createNotification(
                order.patientId,
                "success",
                `Your payment for order ${order.orderNumber} was successful. The vendor is now processing your order.`,
                { orderId: order.id }
            );
        } catch { /* non-critical */ }

        return orderRepository.findById(order.id);
    }

    // ─── Vendor: mark order complete ─────────────────────────────────────────

    async completeOrder(userId, orderId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const order = await orderRepository.findById(orderId);
        if (!order) throw new Error("Order not found");
        if (order.vendorId !== vendor.id) throw new Error("Order not found");
        if (order.status !== "processing") throw new Error("Only processing orders can be marked as completed");

        await orderRepository.update(orderId, {
            status:      "completed",
            completedAt: new Date(),
        });

        try {
            await notificationService.createNotification(
                order.patientId,
                "success",
                `Your order ${order.orderNumber} has been completed by the vendor.`,
                { orderId }
            );
        } catch { /* non-critical */ }

        return orderRepository.findById(orderId);
    }

    // ─── Cancel order ────────────────────────────────────────────────────────

    async cancelOrder(userId, orderId, cancelledBy) {
        const order = await orderRepository.findById(orderId);
        if (!order) throw new Error("Order not found");

        if (cancelledBy === "patient" && order.patientId !== userId) throw new Error("Order not found");
        if (cancelledBy === "vendor") {
            const vendor = await vendorRepository.findByUserId(userId);
            if (!vendor || order.vendorId !== vendor.id) throw new Error("Order not found");
        }

        if (!["pending", "processing"].includes(order.status)) {
            throw new Error("Only pending or processing orders can be cancelled");
        }
        if (order.paymentStatus === "paid") {
            throw new Error("Paid orders cannot be self-cancelled. Please raise a dispute.");
        }

        await orderRepository.update(orderId, {
            status:      "cancelled",
            cancelledBy,
            cancelledAt: new Date(),
        });

        try {
            const notifyUserId = cancelledBy === "patient" ? order.vendorId : order.patientId;
            await notificationService.createNotification(
                notifyUserId,
                "alert",
                `Order ${order.orderNumber} has been cancelled.`,
                { orderId }
            );
        } catch { /* non-critical */ }

        return orderRepository.findById(orderId);
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    async getPatientOrders(patientId, { status, page, limit }) {
        return orderRepository.findByPatientPaginated({
            patientId,
            status,
            page:  Number(page  || 1),
            limit: Number(limit || 20),
        });
    }

    async getPatientOrderById(patientId, orderId) {
        const order = await orderRepository.findById(orderId);
        if (!order || order.patientId !== patientId) throw new Error("Order not found");
        return order;
    }

    async getVendorOrders(userId, { status, paymentStatus, page, limit }) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");
        return orderRepository.findByVendorPaginated({
            vendorId: vendor.id,
            status,
            paymentStatus,
            page:  Number(page  || 1),
            limit: Number(limit || 20),
        });
    }

    async getVendorOrderById(userId, orderId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");
        const order = await orderRepository.findById(orderId);
        if (!order || order.vendorId !== vendor.id) throw new Error("Order not found");
        return order;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    async _deductInventory(cartId) {
        try {
            const cart = await cartRepository.findById(cartId);
            if (!cart || !cart.items) return;

            for (const item of cart.items) {
                if (!item.productId) continue;
                await AppDataSource.getRepository("Product")
                    .decrement({ id: item.productId }, "stockQuantity", item.quantity);
            }
        } catch (err) {
            // Inventory deduction failure is logged but does not roll back payment
            console.error("[OrderService] Inventory deduction error:", err.message);
        }
    }

    _buildCheckoutResponse(order) {
        return {
            orderId:           order.id,
            orderNumber:       order.orderNumber,
            status:            order.status,
            paymentStatus:     order.paymentStatus,
            subtotal:          order.subtotal,          // vendor's base price
            platformFeeAmount: order.platformFeeAmount, // 7% added on top
            grossAmount:       order.grossAmount,        // what customer pays
            commissionRate:    order.commissionRate,     // vendor commission rate (currently 0)
            commissionAmount:  order.commissionAmount,   // commission in NGN
            vendorAmount:      order.vendorAmount,       // vendor receives this
            currency:          order.currency,
            paymentAuthUrl:    order.paymentAuthUrl || null,
        };
    }
}

module.exports = new OrderService();
