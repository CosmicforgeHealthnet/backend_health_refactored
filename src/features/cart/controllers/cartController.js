const cartService = require("../services/cartService");

class CartController {
    async addItem(req, res, next) {
        try {
            const { productId, quantity } = req.body;
            const { vendorId } = req.params;

            if (!productId) {
                return res.status(400).json({ success: false, error: "productId is required" });
            }

            const cart = await cartService.addItem(req.user.id, vendorId, { productId, quantity });
            return res.status(200).json({
                success: true,
                message: "Item added to cart",
                cart: formatCart(cart),
            });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async removeItem(req, res, next) {
        try {
            const cart = await cartService.removeItem(req.user.id, req.params.cartId, req.params.itemId);
            return res.status(200).json({ success: true, message: "Item removed", cart: formatCart(cart) });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async getMyCart(req, res, next) {
        try {
            const cart = await cartService.getMyCart(req.user.id, req.params.cartId);
            return res.status(200).json({ success: true, cart: formatCart(cart) });
        } catch (error) {
            if (isClientError(error)) return res.status(404).json({ success: false, error: error.message });
            next(error);
        }
    }

    async getMyCarts(req, res, next) {
        try {
            const { status, page, limit } = req.query;
            const result = await cartService.getMyCartsByStatus(req.user.id, { status, page, limit });
            return res.status(200).json({
                success: true,
                ...result,
                carts: result.carts.map(formatCart),
            });
        } catch (error) {
            next(error);
        }
    }

    async initiatePayment(req, res, next) {
        try {
            const { provider, email, phone, name, currency, callbackUrl } = req.body;
            if (!provider || !["flutterwave", "paystack"].includes(provider)) {
                return res.status(400).json({ success: false, error: "provider must be 'flutterwave' or 'paystack'" });
            }
            if (!email) {
                return res.status(400).json({ success: false, error: "email is required" });
            }
            const result = await cartService.initiateCartPayment(req.user.id, req.params.cartId, {
                provider, email, phone, name, currency, callbackUrl,
            });
            return res.status(200).json({
                success: true,
                message: "Payment initiated. Redirect the patient to redirectUrl to complete payment.",
                data: result,
            });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async submitCart(req, res, next) {
        try {
            const { patientNote, prescriptionId, items } = req.body;
            const cart = await cartService.submitCart(req.user.id, req.params.cartId, patientNote, prescriptionId, items);
            return res.status(200).json({
                success: true,
                message: "Cart submitted to vendor. They will review and confirm pricing.",
                cart: formatCart(cart),
            });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async cancelCart(req, res, next) {
        try {
            const cart = await cartService.cancelCart(req.user.id, req.params.cartId);
            return res.status(200).json({ success: true, message: "Cart cancelled", cart: formatCart(cart) });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }
}

function formatCart(c) {
    return {
        id:        c.id,
        status:    c.status,
        prescriptionId: c.prescriptionId || null,
        patientNote:    c.patientNote,
        vendorNote:     c.vendorNote,
        confirmedTotal: c.confirmedTotal,
        submittedAt:  c.submittedAt,
        confirmedAt:  c.confirmedAt,
        paidAt:       c.paidAt || null,
        cancelledAt:  c.cancelledAt,
        cancelledBy:  c.cancelledBy,
        vendor: c.vendor
            ? { id: c.vendor.id, businessName: c.vendor.businessName, logoUrl: c.vendor.logoUrl }
            : undefined,
        items: (c.items || []).map((item) => ({
            id:            item.id,
            productId:     item.productId,
            productTitle:  item.productTitle,
            quantity:      item.quantity,
            priceSnapshot: item.priceSnapshot,
            lineTotal:     (Number(item.priceSnapshot) * item.quantity).toFixed(2),
            product: item.product
                ? { id: item.product.id, title: item.product.title, media: item.product.media || [] }
                : undefined,
        })),
        itemCount:     (c.items || []).length,
        estimatedTotal: (c.items || [])
            .reduce((sum, i) => sum + Number(i.priceSnapshot) * i.quantity, 0)
            .toFixed(2),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
    };
}

function isClientError(error) {
    return (
        error.message.includes("not found") ||
        error.message.includes("Cannot") ||
        error.message.includes("not available") ||
        error.message.includes("out of stock") ||
        error.message.includes("already") ||
        error.message.includes("must be") ||
        error.message.includes("empty") ||
        error.message.includes("does not belong") ||
        error.message.includes("positive") ||
        error.message.includes("must have a valid") ||
        error.message.includes("is not in this cart")
    );
}

module.exports = new CartController();
