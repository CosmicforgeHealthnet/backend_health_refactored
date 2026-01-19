// services/InsuranceService.js
const InsuranceRepository = require('../repositories/InsuranceRepository');
const userRepository = require('../../auth/repositories/userRepository');

class InsuranceService {
  constructor() {
    this.insuranceRepository = new InsuranceRepository();
  }

  async getAllInsuranceTickets() {
    try {
      return await this.insuranceRepository.findAll();
    } catch (error) {
      throw new Error(`Failed to get insurance tickets: ${error.message}`);
    }
  }

  async getInsuranceTicketById(id) {
    try {
      const ticket = await this.insuranceRepository.findById(id);
      if (!ticket) {
        throw new Error('Insurance ticket not found');
      }
      return ticket;
    } catch (error) {
      throw new Error(`Failed to get insurance ticket: ${error.message}`);
    }
  }

  async createInsuranceTicket(ticketData) {
    try {
      // Validate user exists
      const user = await userRepository.findById(ticketData.userId);
      if (!user) {
        throw new Error('User not found');
      }

      return await this.insuranceRepository.create(ticketData);
    } catch (error) {
      throw new Error(`Failed to create insurance ticket: ${error.message}`);
    }
  }

  async updateInsuranceTicket(id, ticketData) {
    try {
      const ticket = await this.insuranceRepository.findById(id);
      if (!ticket) {
        throw new Error('Insurance ticket not found');
      }

      return await this.insuranceRepository.update(id, ticketData);
    } catch (error) {
      throw new Error(`Failed to update insurance ticket: ${error.message}`);
    }
  }

  async getUserInsuranceTickets(userId) {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return await this.insuranceRepository.findByUserId(userId);
    } catch (error) {
      throw new Error(`Failed to get user insurance tickets: ${error.message}`);
    }
  }
}

module.exports = InsuranceService;