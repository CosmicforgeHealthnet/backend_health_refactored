// src/services/disputeService.js
const disputeRepository = require("../repositories/disputeRepository");
const transactionRepository = require("../repositories/transactionRepository");
const transactionSplitRepository = require("../repositories/transactionSplitRepository");
const doctorWalletRepository = require("../../payments/repositories/doctorWalletRepository");

class DisputeService {
  /**
   * Create a refund request
   * @param {Object} data - Dispute data
   * @returns {Promise<Object>} - Created dispute
   */
  async createRefundRequest(data) {
    const { transactionId, patientId, reason, description } = data;

    const transaction = await transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.patientId !== patientId) {
      throw new Error("Unauthorized to dispute this transaction");
    }

    if (transaction.status !== 'completed') {
      throw new Error("Can only dispute completed transactions");
    }

    if (new Date() > transaction.disputeWindowEndsAt) {
      throw new Error("Dispute window has expired");
    }

    // Check if dispute already exists
    const existingDisputes = await disputeRepository.findByTransactionId(transactionId);
    if (existingDisputes.length > 0) {
      throw new Error("Dispute already exists for this transaction");
    }

    const disputeData = {
      transactionId,
      patientId,
      doctorId: transaction.doctorId,
      type: 'refund_request',
      reason,
      patientDescription: description,
      status: 'pending'
    };

    const dispute = disputeRepository.create(disputeData);
    const savedDispute = await disputeRepository.save(dispute);

    // Mark transaction as disputed
    await transactionRepository.updateStatus(transactionId, 'disputed', {
      disputeRaisedAt: new Date()
    });

    return savedDispute;
  }

  /**
   * Doctor responds to dispute
   * @param {Object} data - Response data
   * @returns {Promise<Object>} - Updated dispute
   */
  async respondToDispute(data) {
    const { disputeId, doctorId, action, response } = data;

    const dispute = await disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new Error("Dispute not found");
    }

    if (dispute.doctorId !== doctorId) {
      throw new Error("Unauthorized to respond to this dispute");
    }

    if (dispute.status !== 'pending') {
      throw new Error("Dispute is no longer pending");
    }

    if (action === 'approve') {
      // Approve refund
      await this.processRefund(dispute);
      await disputeRepository.updateStatus(disputeId, 'approved', {
        doctorResponse: response
      });
    } else if (action === 'escalate') {
      // Escalate to admin
      await disputeRepository.escalateToAdmin(disputeId, response);
    } else {
      throw new Error("Invalid action. Must be 'approve' or 'escalate'");
    }

    return await disputeRepository.findById(disputeId);
  }

  /**
   * Process approved refund
   * @param {Object} dispute - Dispute object
   * @returns {Promise<void>}
   */
  async processRefund(dispute) {
    const transaction = dispute.transaction;
    const splits = await transactionSplitRepository.findByTransactionId(transaction.id);

    // Only refund appointment fee, not service fee or VAT
    const appointmentSplit = splits.find(split => split.type === 'appointment_fee');

    if (appointmentSplit) {
      // If funds are still pending, just remove from pending
      // If already released, deduct from available balance
      if (appointmentSplit.status === 'pending') {
        await doctorWalletRepository.addPendingCredits(
          transaction.doctorId,
          -appointmentSplit.usdAmount
        );
      } else {
        await doctorWalletRepository.deductAvailableBalance(
          transaction.doctorId,
          appointmentSplit.usdAmount
        );
      }

      // Update split status
      await transactionSplitRepository.updateStatus(appointmentSplit.id, 'refunded');
    }

    // Update transaction status
    await transactionRepository.updateStatus(transaction.id, 'refunded');
  }

  /**
   * Get disputes for a doctor
   * @param {string} doctorId - Doctor's user ID
   * @returns {Promise<Array>} - Doctor's disputes
   */
  async getDoctorDisputes(doctorId) {
    return await disputeRepository.findByDoctorId(doctorId);
  }

  /**
   * Get disputes for a patient
   * @param {string} patientId - Patient's user ID
   * @returns {Promise<Array>} - Patient's disputes
   */
  async getPatientDisputes(patientId) {
    return await disputeRepository.findByPatientId(patientId);
  }

  /**
   * Get all pending disputes (admin function)
   * @returns {Promise<Array>} - All pending disputes
   */
  async getPendingDisputes() {
    return await disputeRepository.findPendingDisputes();
  }
}

module.exports = new DisputeService();