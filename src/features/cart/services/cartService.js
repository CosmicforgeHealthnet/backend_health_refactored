const cartRepository    = require("../repositories/cartRepository");
const productRepository = require("../../vendor/repositories/productRepository");
const vendorRepository  = require("../../vendor/repositories/vendorRepository");
const NotificationService = require("../../notifications/services/notificationService");

const notificationService = new NotificationService();

class CartService {

    // ─── Patient operations ───────────────────────────────────────────────────

    async addItem(patientId, vendorId, { productId, quantity = 1 }) {
        const vendor = await vendorRepository.findById(vendorId);
        if (!vendor || vendor.verificationStatus !== "approved") {
            throw new Error("Vendor not found");
        }

        const product = await productRepository.findById(productId);
        if (!product || product.status !== "approved" || !product.isActive) {
            throw new Error("Product not available");
        }
        if (product.vendorId !== vendorId) {
            throw new Error("Product does not belong to this vendor");
        }
        if (product.stockQuantity < 1) {
            throw new Error("Product is out of stock");
        }
        if (quantity < 1) {
            throw new Error("Quantity must be at least 1");
        }

        // Get or create the draft cart for this patient + vendor pair
        let cart = await cartRepository.findDraftByPatientAndVendor(patientId, vendorId);
        if (!cart) {
            cart = await cartRepository.saveCart({ patientId, vendorId, status: "draft" });
        }

        // If product already in cart — increase quantity
        const existingItem = await cartRepository.findItemByCartAndProduct(cart.id, productId);
        if (existingItem) {
            await cartRepository.updateItem(existingItem.id, {
                quantity: existingItem.quantity + quantity,
            });
        } else {
            await cartRepository.saveItem({
                cartId:        cart.id,
                productId,
                quantity,
                priceSnapshot: product.price,
                productTitle:  product.title,
            });
        }

        return cartRepository.findByIdAndPatient(cart.id, patientId);
    }

    async updateItemQuantity(patientId, cartId, itemId, quantity) {
        if (quantity < 1) throw new Error("Quantity must be at least 1");

        const cart = await cartRepository.findByIdAndPatient(cartId, patientId);
        if (!cart) throw new Error("Cart not found");
        if (cart.status !== "draft") throw new Error("Cannot modify a submitted cart");

        const item = await cartRepository.findItemById(itemId);
        if (!item || item.cart.id !== cartId) throw new Error("Cart item not found");

        await cartRepository.updateItem(itemId, { quantity });
        return cartRepository.findByIdAndPatient(cartId, patientId);
    }

    async removeItem(patientId, cartId, itemId) {
        const cart = await cartRepository.findByIdAndPatient(cartId, patientId);
        if (!cart) throw new Error("Cart not found");
        if (cart.status !== "draft") throw new Error("Cannot modify a submitted cart");

        const item = await cartRepository.findItemById(itemId);
        if (!item || item.cart.id !== cartId) throw new Error("Cart item not found");

        await cartRepository.deleteItem(itemId);
        return cartRepository.findByIdAndPatient(cartId, patientId);
    }

    async getMyCart(patientId, cartId) {
        const cart = await cartRepository.findByIdAndPatient(cartId, patientId);
        if (!cart) throw new Error("Cart not found");
        return cart;
    }

    async getMyCartsByStatus(patientId, { status, page, limit }) {
        return cartRepository.findByPatientPaginated({
            patientId,
            status,
            page:  Number(page  || 1),
            limit: Number(limit || 20),
        });
    }

    async submitCart(patientId, cartId, patientNote) {
        const cart = await cartRepository.findByIdAndPatient(cartId, patientId);
        if (!cart) throw new Error("Cart not found");
        if (cart.status !== "draft") throw new Error("Cart has already been submitted");
        if (!cart.items || cart.items.length === 0) throw new Error("Cannot submit an empty cart");

        // Auto-confirm at listed product prices — no vendor confirmation step needed
        const confirmedTotal = parseFloat(
            cart.items.reduce((sum, item) =>
                sum + parseFloat(item.priceSnapshot) * item.quantity, 0
            ).toFixed(2)
        );

        const now = new Date();
        await cartRepository.updateCart(cartId, {
            status:         "confirmed",
            patientNote:    patientNote || null,
            submittedAt:    now,
            confirmedAt:    now,
            confirmedTotal,
        });

        // Notify vendor — order is ready, no action needed before payment
        try {
            await notificationService.createNotification(
                cart.vendorId,
                "notification",
                `New order received from a customer. Payment is pending.`,
                { cartId, patientId }
            );
        } catch {
            // Notifications are non-critical
        }

        return cartRepository.findByIdAndPatient(cartId, patientId);
    }

    async cancelCart(patientId, cartId) {
        const cart = await cartRepository.findByIdAndPatient(cartId, patientId);
        if (!cart) throw new Error("Cart not found");
        if (cart.status === "cancelled") throw new Error("Cart is already cancelled");
        if (cart.status === "confirmed") throw new Error("Cannot cancel a confirmed cart");

        await cartRepository.updateCart(cartId, {
            status:      "cancelled",
            cancelledAt: new Date(),
            cancelledBy: "patient",
        });

        return cartRepository.findByIdAndPatient(cartId, patientId);
    }

    // ─── Vendor operations ────────────────────────────────────────────────────

    async getVendorCarts(vendorId, { status, page, limit }) {
        return cartRepository.findByVendorPaginated({
            vendorId,
            status,
            page:  Number(page  || 1),
            limit: Number(limit || 20),
        });
    }

    async getVendorCartById(vendorId, cartId) {
        const cart = await cartRepository.findByIdAndVendor(cartId, vendorId);
        if (!cart) throw new Error("Cart not found");
        return cart;
    }

    async confirmCartPricing(vendorId, cartId, { confirmedTotal, vendorNote }) {
        const cart = await cartRepository.findByIdAndVendor(cartId, vendorId);
        if (!cart) throw new Error("Cart not found");
        if (cart.status !== "submitted") throw new Error("Only submitted carts can be confirmed");
        if (!confirmedTotal || confirmedTotal <= 0) throw new Error("confirmedTotal must be a positive number");

        await cartRepository.updateCart(cartId, {
            status:         "confirmed",
            confirmedTotal,
            vendorNote:     vendorNote || null,
            confirmedAt:    new Date(),
        });

        // Notify the patient
        try {
            await notificationService.createNotification(
                cart.patient.id,
                "notification",
                `Your cart has been reviewed. The vendor has confirmed the total pricing. Check your cart for details.`,
                { cartId, confirmedTotal }
            );
        } catch {
            // Non-critical
        }

        return cartRepository.findByIdAndVendor(cartId, vendorId);
    }

    async vendorCancelCart(vendorId, cartId) {
        const cart = await cartRepository.findByIdAndVendor(cartId, vendorId);
        if (!cart) throw new Error("Cart not found");
        if (cart.status === "cancelled") throw new Error("Cart is already cancelled");
        if (cart.status === "confirmed") throw new Error("Cannot cancel a confirmed cart");

        await cartRepository.updateCart(cartId, {
            status:      "cancelled",
            cancelledAt: new Date(),
            cancelledBy: "vendor",
        });

        // Notify patient
        try {
            await notificationService.createNotification(
                cart.patient.id,
                "alert",
                "A vendor has cancelled your cart. You can create a new cart or contact the vendor.",
                { cartId }
            );
        } catch {
            // Non-critical
        }

        return cartRepository.findByIdAndVendor(cartId, vendorId);
    }
}

module.exports = new CartService();
