const shipmentService = require("../services/shipmentService");

function isClientError(msg) {
    return (
        msg.includes("not found") ||
        msg.includes("No shipment found") ||
        msg.includes("required") ||
        msg.includes("must be") ||
        msg.includes("already") ||
        msg.includes("Cannot") ||
        msg.includes("unpaid") ||
        msg.includes("Only processing")
    );
}

class ShipmentController {

    // ─── Vendor ───────────────────────────────────────────────────────────────

    async dispatchOrder(req, res, next) {
        try {
            const shipment = await shipmentService.dispatchOrder(req.user.id, req.params.orderId, req.body);
            return res.status(201).json({
                success: true,
                message: "Order dispatched. Customer has been notified.",
                shipment,
            });
        } catch (error) {
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async markDelivered(req, res, next) {
        try {
            const shipment = await shipmentService.markDelivered(req.user.id, req.params.orderId);
            return res.status(200).json({
                success: true,
                message: "Order marked as delivered.",
                shipment,
            });
        } catch (error) {
            if (isClientError(error.message)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async getVendorShipment(req, res, next) {
        try {
            const shipment = await shipmentService.getByOrderForVendor(req.user.id, req.params.orderId);
            return res.status(200).json({ success: true, shipment });
        } catch (error) {
            if (isClientError(error.message)) return res.status(404).json({ success: false, error: error.message });
            next(error);
        }
    }

    getSupportedProviders(req, res) {
        return res.status(200).json({
            success:   true,
            providers: shipmentService.getSupportedProviders(),
        });
    }

    // ─── Patient ──────────────────────────────────────────────────────────────

    async getPatientShipment(req, res, next) {
        try {
            const shipment = await shipmentService.getByOrderForPatient(req.user.id, req.params.orderId);
            return res.status(200).json({ success: true, shipment });
        } catch (error) {
            if (isClientError(error.message)) return res.status(404).json({ success: false, error: error.message });
            next(error);
        }
    }
}

module.exports = new ShipmentController();
