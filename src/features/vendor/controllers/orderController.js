const orderService = require("../services/orderService");

function isClientError(msg) {
    return (
        msg.includes("not found") ||
        msg.includes("must be") ||
        msg.includes("already") ||
        msg.includes("Only") ||
        msg.includes("Cannot") ||
        msg.includes("Paid") ||
        msg.includes("confirmed") ||
        msg.includes("dispute")
    );
}

function formatOrder(o) {
    return {
        id:                o.id,
        orderNumber:       o.orderNumber,
        cartId:            o.cartId,
        status:            o.status,
        paymentStatus:     o.paymentStatus,
        subtotal:          o.subtotal,          // vendor's base price
        platformFeeAmount: o.platformFeeAmount, // 7% added on top (customer-facing)
        grossAmount:       o.grossAmount,        // what customer actually pays
        commissionRate:    o.commissionRate,     // vendor commission rate (currently 0 — TBD)
        commissionAmount:  o.commissionAmount,   // commission in NGN
        vendorAmount:      o.vendorAmount,       // vendor receives this
        currency:          o.currency,
        paymentAuthUrl:    o.paymentAuthUrl || null,
        patientNote:       o.patientNote,
        vendorNote:        o.vendorNote,
        deliveryMethod:    o.deliveryMethod || null,
        deliveryAddress:   o.deliveryAddress || null,
        cancelledBy:       o.cancelledBy || null,
        cancelledAt:       o.cancelledAt || null,
        completedAt:       o.completedAt || null,
        paidAt:            o.paidAt || null,
        vendor:  o.vendor  ? { id: o.vendor.id,  businessName: o.vendor.businessName,  logoUrl: o.vendor.logoUrl }  : undefined,
        patient: o.patient ? { id: o.patient.id, fullName: o.patient.fullName, email: o.patient.email } : undefined,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
    };
}

class OrderController {

    // ─── Patient ──────────────────────────────────────────────────────────────

    async initiateCheckout(req, res, next) {
        try {
            const { cartId } = req.params;
            if (!cartId) return res.status(400).json({ success: false, error: "cartId is required" });

            const result = await orderService.initiateCheckout(req.user.id, cartId);
            return res.status(201).json({
                success: true,
                message: "Checkout initiated. Proceed to payment.",
                ...result,
            });
        } catch (error) {
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async initiatePayment(req, res, next) {
        try {
            const result = await orderService.initiatePayment(req.user.id, req.params.orderId);
            return res.status(200).json({
                success: true,
                message: "Proceed to the payment URL to complete your order.",
                ...result,
            });
        } catch (error) {
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async getMyOrders(req, res, next) {
        try {
            const { status, page, limit } = req.query;
            const result = await orderService.getPatientOrders(req.user.id, { status, page, limit });
            return res.status(200).json({
                success: true,
                ...result,
                orders: result.orders.map(formatOrder),
            });
        } catch (error) {
            next(error);
        }
    }

    async getMyOrderById(req, res, next) {
        try {
            const order = await orderService.getPatientOrderById(req.user.id, req.params.orderId);
            return res.status(200).json({ success: true, order: formatOrder(order) });
        } catch (error) {
            if (isClientError(error.message)) return res.status(404).json({ success: false, error: error.message });
            next(error);
        }
    }

    async cancelMyOrder(req, res, next) {
        try {
            const order = await orderService.cancelOrder(req.user.id, req.params.orderId, "patient");
            return res.status(200).json({ success: true, message: "Order cancelled", order: formatOrder(order) });
        } catch (error) {
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    // ─── Vendor ───────────────────────────────────────────────────────────────

    async getVendorOrders(req, res, next) {
        try {
            const { status, paymentStatus, page, limit } = req.query;
            const result = await orderService.getVendorOrders(req.user.id, { status, paymentStatus, page, limit });
            return res.status(200).json({
                success: true,
                ...result,
                orders: result.orders.map(formatOrder),
            });
        } catch (error) {
            next(error);
        }
    }

    async getVendorOrderById(req, res, next) {
        try {
            const order = await orderService.getVendorOrderById(req.user.id, req.params.orderId);
            return res.status(200).json({ success: true, order: formatOrder(order) });
        } catch (error) {
            if (isClientError(error.message)) return res.status(404).json({ success: false, error: error.message });
            next(error);
        }
    }

    async completeOrder(req, res, next) {
        try {
            const order = await orderService.completeOrder(req.user.id, req.params.orderId);
            return res.status(200).json({ success: true, message: "Order marked as completed", order: formatOrder(order) });
        } catch (error) {
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async cancelVendorOrder(req, res, next) {
        try {
            const order = await orderService.cancelOrder(req.user.id, req.params.orderId, "vendor");
            return res.status(200).json({ success: true, message: "Order cancelled", order: formatOrder(order) });
        } catch (error) {
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }
}

module.exports = new OrderController();
