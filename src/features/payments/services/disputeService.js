// src/services/disputeService.js
const disputeRepository = require("../repositories/disputeRepository");
const transactionRepository = require("../repositories/transactionRepository");
const transactionSplitRepository = require("../repositories/transactionSplitRepository");
const doctorWalletRepository = require("../../payments/repositories/doctorWalletRepository");
const paymentService = require("./paymentService");

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
    await transactionRepository.updateStatus(transactionId, 'disputed');

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
   * Process approved refund — adjusts wallet AND sends money back via provider
   * @param {Object} dispute - Dispute object
   * @param {number|null} overrideRefundAmount - Optional admin-specified amount (USD), defaults to appointment fee
   * @returns {Promise<void>}
   */
  async processRefund(dispute, overrideRefundAmount = null) {
    // Load full transaction to ensure all provider fields are present
    const transaction = await transactionRepository.findById(dispute.transactionId);
    const splits = await transactionSplitRepository.findByTransactionId(transaction.id);
    const appointmentSplit = splits.find(split => split.type === 'appointment_fee');

    const refundAmount = overrideRefundAmount !== null
      ? overrideRefundAmount
      : (appointmentSplit ? appointmentSplit.usdAmount : 0);

    if (refundAmount <= 0) {
      await transactionRepository.updateStatus(transaction.id, 'refunded');
      return;
    }

    // Deduct from doctor wallet
    if (appointmentSplit) {
      if (appointmentSplit.status === 'pending') {
        await doctorWalletRepository.removePendingCredits(
          transaction.doctorId,
          appointmentSplit.usdAmount
        );
      } else {
        await doctorWalletRepository.deductAvailableBalance(
          transaction.doctorId,
          appointmentSplit.usdAmount
        );
      }
      await transactionSplitRepository.updateStatus(appointmentSplit.id, 'refunded');
    }

    // Actually send money back to patient via payment provider
    const refundResult = await paymentService.processRefund(transaction, refundAmount);
    if (!refundResult.success) {
      throw new Error(`Refund payment failed: ${refundResult.error}`);
    }

    await transactionRepository.repo.update(transaction.id, {
      status: 'refunded',
      refundAmount,
      refundStatus: 'full',
      refundProcessedAt: new Date()
    });
  }

  /**
   * Admin resolves an escalated dispute
   * @param {Object} data - { disputeId, action: 'approve'|'reject', adminNotes, refundAmount }
   * @returns {Promise<Object>} - Updated dispute
   */
  async resolveDispute(data) {
    const { disputeId, action, adminNotes, refundAmount } = data;

    const dispute = await disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new Error("Dispute not found");
    }

    if (dispute.status !== 'escalated') {
      throw new Error("Can only resolve escalated disputes");
    }

    if (action === 'approve') {
      await this.processRefund(dispute, refundAmount || null);
      await disputeRepository.updateStatus(disputeId, 'resolved', {
        adminNotes: adminNotes || null,
        resolvedAt: new Date()
      });
    } else if (action === 'reject') {
      // Dispute rejected — funds stay with doctor, restore transaction to completed
      await transactionRepository.updateStatus(dispute.transactionId, 'completed');
      await disputeRepository.updateStatus(disputeId, 'resolved', {
        adminNotes: adminNotes || null,
        resolvedAt: new Date()
      });
    } else {
      throw new Error("Invalid action. Must be 'approve' or 'reject'");
    }

    return await disputeRepository.findById(disputeId);
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