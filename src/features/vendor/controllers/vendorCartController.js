const cartService      = require("../../cart/services/cartService");
const vendorRepository = require("../repositories/vendorRepository");

class VendorCartController {
    async getVendorCarts(req, res, next) {
        try {
            const vendor = await vendorRepository.findByUserId(req.user.id);
            if (!vendor) return res.status(404).json({ success: false, error: "Vendor profile not found" });

            const { status, page, limit } = req.query;
            const result = await cartService.getVendorCarts(vendor.id, { status, page, limit });

            return res.status(200).json({
                success: true,
                ...result,
                carts: result.carts.map(formatVendorCart),
            });
        } catch (error) {
            next(error);
        }
    }

    async getVendorCartById(req, res, next) {
        try {
            const vendor = await vendorRepository.findByUserId(req.user.id);
            if (!vendor) return res.status(404).json({ success: false, error: "Vendor profile not found" });

            const cart = await cartService.getVendorCartById(vendor.id, req.params.cartId);
            return res.status(200).json({ success: true, cart: formatVendorCart(cart) });
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    async confirmCartPricing(req, res, next) {
        try {
            const { confirmedTotal, vendorNote } = req.body;
            if (!confirmedTotal) {
                return res.status(400).json({ success: false, error: "confirmedTotal is required" });
            }

            const vendor = await vendorRepository.findByUserId(req.user.id);
            if (!vendor) return res.status(404).json({ success: false, error: "Vendor profile not found" });

            const cart = await cartService.confirmCartPricing(vendor.id, req.params.cartId, {
                confirmedTotal: Number(confirmedTotal),
                vendorNote,
            });

            return res.status(200).json({
                success: true,
                message: "Cart pricing confirmed. The customer has been notified.",
                cart: formatVendorCart(cart),
            });
        } catch (error) {
            if (error.message.includes("not found") || error.message.includes("Only") || error.message.includes("positive")) {
                return res.status(400).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    async cancelCart(req, res, next) {
        try {
            const vendor = await vendorRepository.findByUserId(req.user.id);
            if (!vendor) return res.status(404).json({ success: false, error: "Vendor profile not found" });

            const cart = await cartService.vendorCancelCart(vendor.id, req.params.cartId);
            return res.status(200).json({
                success: true,
                message: "Cart cancelled. The customer has been notified.",
                cart: formatVendorCart(cart),
            });
        } catch (error) {
            if (error.message.includes("not found") || error.message.includes("already") || error.message.includes("Cannot")) {
                return res.status(400).json({ success: false, error: error.message });
            }
            next(error);
        }
    }
}

function formatVendorCart(c) {
    return {
        id:             c.id,
        status:         c.status,
        patientNote:    c.patientNote,
        vendorNote:     c.vendorNote,
        confirmedTotal: c.confirmedTotal,
        submittedAt:    c.submittedAt,
        confirmedAt:    c.confirmedAt,
        cancelledAt:    c.cancelledAt,
        cancelledBy:    c.cancelledBy,
        patient: c.patient
            ? {
                id:          c.patient.id,
                fullName:    c.patient.fullName,
                phoneNumber: c.patient.phoneNumber,
                email:       c.patient.email,
              }
            : undefined,
        items: (c.items || []).map((item) => ({
            id:            item.id,
            productId:     item.productId,
            productTitle:  item.productTitle,
            quantity:      item.quantity,
            priceSnapshot: item.priceSnapshot,
            lineTotal:     (Number(item.priceSnapshot) * item.quantity).toFixed(2),
        })),
        itemCount:      (c.items || []).length,
        estimatedTotal: (c.items || [])
            .reduce((sum, i) => sum + Number(i.priceSnapshot) * i.quantity, 0)
            .toFixed(2),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
    };
}

module.exports = new VendorCartController();
