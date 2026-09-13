const asyncHandler = require("express-async-handler");
const patientAlertService = require("../services/patientAlertService");

class PatientAlertController {
  getAlerts = asyncHandler(async (req, res) => {
    const patientId = req.user.sub || req.user.id;
    const result = await patientAlertService.getAlerts(patientId);
    res.status(200).json(result);
  });
}

module.exports = new PatientAlertController();
