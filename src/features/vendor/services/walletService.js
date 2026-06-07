const walletRepository = require("../repositories/walletRepository");
const vendorRepository = require("../repositories/vendorRepository");

class WalletService {

    async getOrCreateWallet(vendorId) {
        let wallet = await walletRepository.findByVendorId(vendorId);
        if (!wallet) wallet = await walletRepository.createWallet(vendorId);
        return wallet;
    }

    async getWalletSummary(userId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const wallet = await this.getOrCreateWallet(vendor.id);
        return {
            availableBalanceNgn: parseFloat(wallet.availableBalanceNgn),
            pendingClearanceNgn: parseFloat(wallet.pendingClearanceNgn),
            totalEarningsNgn:    parseFloat(wallet.totalEarningsNgn),
            isActive:            wallet.isActive,
            isFrozen:            wallet.isFrozen,
            frozenReason:        wallet.frozenReason || null,
            lastPayoutAt:        wallet.lastPayoutAt || null,
        };
    }

    async getTransactions(userId, { category, page, limit }) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        return walletRepository.findTransactionsByVendor({
            vendorId: vendor.id,
            category,
            page:  Number(page  || 1),
            limit: Number(limit || 20),
        });
    }

    // Called from orderService.handlePaymentSuccess — not a user-facing call
    async creditOrder(vendorId, { orderId, amountNgn, reference, description }) {
        const wallet = await this.getOrCreateWallet(vendorId);

        if (wallet.isFrozen) {
            // Still record the transaction but mark pending until unfrozen
            const balanceAfter = parseFloat(wallet.availableBalanceNgn);
            await walletRepository.saveTransaction({
                walletId:        wallet.id,
                vendorId,
                type:            "credit",
                category:        "order_payment",
                status:          "pending",
                amountNgn,
                balanceAfterNgn: balanceAfter,
                orderId,
                reference,
                description,
            });
            return;
        }

        const newBalance    = parseFloat(wallet.availableBalanceNgn) + amountNgn;
        const newTotalEarnings = parseFloat(wallet.totalEarningsNgn) + amountNgn;

        await walletRepository.update(wallet.id, {
            availableBalanceNgn: parseFloat(newBalance.toFixed(4)),
            totalEarningsNgn:    parseFloat(newTotalEarnings.toFixed(4)),
        });

        await walletRepository.saveTransaction({
            walletId:        wallet.id,
            vendorId,
            type:            "credit",
            category:        "order_payment",
            status:          "completed",
            amountNgn,
            balanceAfterNgn: parseFloat(newBalance.toFixed(4)),
            orderId,
            reference,
            description,
        });
    }
}

module.exports = new WalletService();
