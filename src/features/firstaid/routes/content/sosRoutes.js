const express = require("express");
const router = express.Router();
const SOSController = require("../../../firstaid/controllers/sosController");
const { getLocationFromIP } = require("../../../shared/middlewares/locationMiddleware");

router.use(getLocationFromIP);

// Emergency numbers endpoints
router.get("/emergency-numbers", SOSController.getEmergencyNumbers);
router.get("/emergency-numbers/by-country", SOSController.getEmergencyNumbersByCountry);

// Emergency by type (returns specific number only)
router.get("/emergency/:type", SOSController.getEmergencyByType);

// Service endpoints (with quick call info)
router.get("/service/:type", SOSController.getSpecificService);

// Safety tips endpoints
router.get("/safety-tips/:type", SOSController.getSafetyTips);
router.get("/safety-tips", SOSController.getAllSafetyTips);

module.exports = router;