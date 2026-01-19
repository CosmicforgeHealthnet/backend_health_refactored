// services/DisputeService.js
const DisputeRepository = require('../repositories/DisputeRepository');
const userRepository = require('../../auth/repositories/userRepository');

class DisputeService {
  constructor() {
    this.disputeRepository = new DisputeRepository();
    // this.transactionRepository = new TransactionRepository();
  }

  async getAllDisputes() {
    try {
      return await this.disputeRepository.findAll();
    } catch (error) {
      throw new Error(`Failed to get disputes: ${error.message}`);
    }
  }

  async getDisputeById(id) {
    try {
      const dispute = await this.disputeRepository.findById(id);
      if (!dispute) {
        throw new Error('Dispute not found');
      }
      return dispute;
    } catch (error) {
      throw new Error(`Failed to get dispute: ${error.message}`);
    }
  }

  async createDispute(disputeData) {
    try {
      // Validate user exists
      const user = await userRepository.findById(disputeData.userId);
      if (!user) {
        throw new Error('User not found');
      }

      return await this.disputeRepository.create(disputeData);
    } catch (error) {
      throw new Error(`Failed to create dispute: ${error.message}`);
    }
  }

  async updateDispute(id, disputeData) {
    try {
      const dispute = await this.disputeRepository.findById(id);
      if (!dispute) {
        throw new Error('Dispute not found');
      }

      return await this.disputeRepository.update(id, disputeData);
    } catch (error) {
      throw new Error(`Failed to update dispute: ${error.message}`);
    }
  }

  async getUserDisputes(userId) {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return await this.disputeRepository.findByUserId(userId);
    } catch (error) {
      throw new Error(`Failed to get user disputes: ${error.message}`);
    }
  }
}

module.exports = DisputeService;