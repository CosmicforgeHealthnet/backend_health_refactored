const walletService = require("../services/walletService");

class WalletController {

    async getSummary(req, res, next) {
        try {
            const summary = await walletService.getWalletSummary(req.user.id);
            return res.status(200).json({ success: true, wallet: summary });
        } catch (error) {
            if (error.message.includes("not found")) return res.status(404).json({ success: false, error: error.message });
            next(error);
        }
    }

    async getTransactions(req, res, next) {
        try {
            const { category, page, limit } = req.query;
            const result = await walletService.getTransactions(req.user.id, { category, page, limit });
            return res.status(200).json({ success: true, ...result });
        } catch (error) {
            if (error.message.includes("not found")) return res.status(404).json({ success: false, error: error.message });
            next(error);
        }
    }
}

module.exports = new WalletController();
