const shipmentRepository  = require("../repositories/shipmentRepository");
const orderRepository     = require("../repositories/orderRepository");
const vendorRepository    = require("../repositories/vendorRepository");
const logisticsService    = require("./logisticsService");
const NotificationService = require("../../notifications/services/notificationService");

const notificationService = new NotificationService();

function formatShipment(s) {
    return {
        id:                  s.id,
        orderId:             s.orderId,
        status:              s.status,
        deliveryMethod:      s.deliveryMethod,
        deliveryAddress:     s.deliveryAddress   || null,
        trackingNumber:      s.trackingNumber    || null,
        logisticsProvider:   s.logisticsProvider || null,
        estimatedDeliveryAt: s.estimatedDeliveryAt || null,
        dispatchedAt:        s.dispatchedAt      || null,
        deliveredAt:         s.deliveredAt       || null,
        vendorNotes:         s.vendorNotes       || null,
        createdAt:           s.createdAt,
        updatedAt:           s.updatedAt,
    };
}

class ShipmentService {

    // ─── Vendor: dispatch order ───────────────────────────────────────────────

    async dispatchOrder(userId, orderId, body) {
        const { deliveryMethod, deliveryAddress, trackingNumber, logisticsProvider, estimatedDeliveryAt, vendorNotes } = body;

        if (!deliveryMethod) throw new Error("deliveryMethod is required (pickup or delivery)");
        if (!["pickup", "delivery"].includes(deliveryMethod)) throw new Error("deliveryMethod must be pickup or delivery");
        if (deliveryMethod === "delivery" && !deliveryAddress) throw new Error("deliveryAddress is required for delivery");

        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const order = await orderRepository.findById(orderId);
        if (!order || order.vendorId !== vendor.id) throw new Error("Order not found");
        if (order.paymentStatus !== "paid") throw new Error("Cannot dispatch an unpaid order");
        if (order.status !== "processing") throw new Error("Only processing orders can be dispatched");

        const existing = await shipmentRepository.findByOrderId(orderId);
        if (existing) throw new Error("Shipment already created for this order");

        const shipment = await shipmentRepository.save({
            orderId,
            vendorId:  vendor.id,
            patientId: order.patientId,
            status:    "dispatched",
            deliveryMethod,
            deliveryAddress:     deliveryAddress     || null,
            trackingNumber:      trackingNumber      || null,
            logisticsProvider:   logisticsProvider   || null,
            estimatedDeliveryAt: estimatedDeliveryAt ? new Date(estimatedDeliveryAt) : null,
            dispatchedAt:        new Date(),
            vendorNotes:         vendorNotes         || null,
        });

        // Update order delivery fields
        await orderRepository.update(orderId, {
            deliveryMethod,
            deliveryAddress: deliveryAddress || null,
        });

        // Notify patient
        try {
            const msg = deliveryMethod === "pickup"
                ? "Your order is ready for pickup."
                : `Your order has been dispatched${trackingNumber ? ` — Tracking: ${trackingNumber}` : ""}.`;
            await notificationService.createNotification(
                order.patientId, "notification", msg, { orderId, shipmentId: shipment.id }
            );
        } catch { /* non-critical */ }

        // Schedule pickup with logistics provider (stub)
        if (logisticsProvider && logisticsProvider !== "custom") {
            logisticsService.schedulePickup(shipment).catch(() => {});
        }

        return formatShipment(shipment);
    }

    // ─── Vendor: mark delivered ───────────────────────────────────────────────

    async markDelivered(userId, orderId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const shipment = await shipmentRepository.findByOrderId(orderId);
        if (!shipment || shipment.vendorId !== vendor.id) throw new Error("Shipment not found");
        if (shipment.status === "delivered") throw new Error("Shipment is already marked as delivered");

        await shipmentRepository.update(shipment.id, {
            status:      "delivered",
            deliveredAt: new Date(),
        });

        // Complete the order
        await orderRepository.update(orderId, {
            status:      "completed",
            completedAt: new Date(),
        });

        const order = await orderRepository.findById(orderId);
        try {
            await notificationService.createNotification(
                order.patientId, "success",
                "Your order has been delivered. Thank you for shopping with us!",
                { orderId, shipmentId: shipment.id }
            );
        } catch { /* non-critical */ }

        return formatShipment(await shipmentRepository.findByOrderId(orderId));
    }

    // ─── Get shipment by order ────────────────────────────────────────────────

    async getByOrderForVendor(userId, orderId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const order = await orderRepository.findById(orderId);
        if (!order || order.vendorId !== vendor.id) throw new Error("Order not found");

        const shipment = await shipmentRepository.findByOrderId(orderId);
        if (!shipment) throw new Error("No shipment found for this order");

        return formatShipment(shipment);
    }

    async getByOrderForPatient(patientId, orderId) {
        const order = await orderRepository.findById(orderId);
        if (!order || order.patientId !== patientId) throw new Error("Order not found");

        const shipment = await shipmentRepository.findByOrderId(orderId);
        if (!shipment) throw new Error("No shipment found for this order yet");

        return formatShipment(shipment);
    }

    // ─── Supported providers (for frontend dropdowns) ─────────────────────────

    getSupportedProviders() {
        return logisticsService.getSupportedProviders();
    }
}

module.exports = new ShipmentService();
