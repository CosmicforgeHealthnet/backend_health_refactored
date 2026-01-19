// ================================
// DISPUTE CONTROLLER
// ================================

// src/controllers/transactions/disputeController.js
const disputeService = require("../services/disputeService");
const ValidationMiddleware = require("../../../shared/middlewares/validation");
const PaymentAuthMiddleware = require("../../payments/middlewares/paymentAuth");

class DisputeController {
  /**
   * Create a refund request (Patient only)
   */
  static async createRefundRequest(req, res) {
    try {
      const disputeData = {
        ...req.validatedData,
        patientId: req.user.sub
      };

      const dispute = await disputeService.createRefundRequest(disputeData);

      res.status(201).json({
        success: true,
        message: "Refund request created successfully",
        data: {
          disputeId: dispute.id,
          transactionId: dispute.transactionId,
          status: dispute.status,
          reason: dispute.reason
        }
      });
    } catch (error) {
      console.error("Error creating refund request:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create refund request"
      });
    }
  }

  /**
   * Respond to dispute (Doctor only)
   */
  static async respondToDispute(req, res) {
    try {
      const responseData = {
        ...req.validatedData,
        doctorId: req.user.sub
      };

      const dispute = await disputeService.respondToDispute(responseData);

      res.status(200).json({
        success: true,
        message: "Dispute response submitted successfully",
        data: {
          disputeId: dispute.id,
          status: dispute.status,
          doctorResponse: dispute.doctorResponse
        }
      });
    } catch (error) {
      console.error("Error responding to dispute:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to respond to dispute"
      });
    }
  }

  /**
   * Get disputes for doctor
   */
  static async getDoctorDisputes(req, res) {
    try {
      const doctorId = req.user.sub;
      const disputes = await disputeService.getDoctorDisputes(doctorId);

      res.status(200).json({
        success: true,
        message: "Doctor disputes retrieved successfully",
        data: disputes
      });
    } catch (error) {
      console.error("Error getting doctor disputes:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get doctor disputes"
      });
    }
  }

  /**
   * Get disputes for patient
   */
  static async getPatientDisputes(req, res) {
    try {
      const patientId = req.user.sub;
      const disputes = await disputeService.getPatientDisputes(patientId);

      res.status(200).json({
        success: true,
        message: "Patient disputes retrieved successfully",
        data: disputes
      });
    } catch (error) {
      console.error("Error getting patient disputes:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get patient disputes"
      });
    }
  }

  /**
   * Get all pending disputes (Admin only)
   */
  static async getPendingDisputes(req, res) {
    try {
      const disputes = await disputeService.getPendingDisputes();

      res.status(200).json({
        success: true,
        message: "Pending disputes retrieved successfully",
        data: disputes
      });
    } catch (error) {
      console.error("Error getting pending disputes:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get pending disputes"
      });
    }
  }
}

module.exports = DisputeController;