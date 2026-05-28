const router                   = require("express").Router();
const hybridPharmacyController = require("../controllers/hybridPharmacyController");
const { authenticateJWT }      = require("../../auth/middlewares/authMiddleware");

router.use(authenticateJWT);

router.get( "/status",  hybridPharmacyController.getVendorModeStatus);
router.post("/enable",  hybridPharmacyController.enableVendorMode);
router.post("/disable", hybridPharmacyController.disableVendorMode);

module.exports = router;
