const router           = require("express").Router();
const walletController = require("../controllers/walletController");
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");

router.use(authenticateJWT);

router.get("/summary",      walletController.getSummary);
router.get("/transactions", walletController.getTransactions);

module.exports = router;
