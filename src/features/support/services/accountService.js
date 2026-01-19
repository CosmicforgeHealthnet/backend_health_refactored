// ===================================
// services/AccountSupportService.js
// ===================================
const AccountSupportRepository = require('../repositories/AccountRepository');
const userRepository = require('../../auth/repositories/userRepository');

class AccountSupportService {
  constructor() {
    this.accountSupportRepository = new AccountSupportRepository();
  }

  async getAllAccountTickets() {
    try {
      return await this.accountSupportRepository.findAll();
    } catch (error) {
      throw new Error(`Failed to get account tickets: ${error.message}`);
    }
  }

  async getAccountTicketById(id) {
    try {
      const ticket = await this.accountSupportRepository.findById(id);
      if (!ticket) {
        throw new Error('Account support ticket not found');
      }
      return ticket;
    } catch (error) {
      throw new Error(`Failed to get account ticket: ${error.message}`);
    }
  }

  async createAccountTicket(ticketData) {
    try {
      // Validate user exists
      const user = await userRepository.findById(ticketData.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Auto-assign priority based on issue type
      if (!ticketData.priority) {
        const highPriorityIssues = ['deactivation_request', 'double_accounts_conflict'];
        ticketData.priority = highPriorityIssues.includes(ticketData.issueType) ? 'high' : 'medium';
      }

      return await this.accountSupportRepository.create(ticketData);
    } catch (error) {
      throw new Error(`Failed to create account ticket: ${error.message}`);
    }
  }

  async updateAccountTicket(id, ticketData) {
    try {
      const ticket = await this.accountSupportRepository.findById(id);
      if (!ticket) {
        throw new Error('Account support ticket not found');
      }

      // If status is being changed to resolved, add timestamp
      if (ticketData.status === 'resolved' && ticket.status !== 'resolved') {
        ticketData.resolvedAt = new Date();
      }

      return await this.accountSupportRepository.update(id, ticketData);
    } catch (error) {
      throw new Error(`Failed to update account ticket: ${error.message}`);
    }
  }

  async getUserAccountTickets(userId) {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return await this.accountSupportRepository.findByUserId(userId);
    } catch (error) {
      throw new Error(`Failed to get user account tickets: ${error.message}`);
    }
  }

  async getAccountTicketsByStatus(status) {
    try {
      return await this.accountSupportRepository.findByStatus(status);
    } catch (error) {
      throw new Error(`Failed to get account tickets by status: ${error.message}`);
    }
  }

  async getAccountTicketsByIssueType(issueType) {
    try {
      return await this.accountSupportRepository.findByIssueType(issueType);
    } catch (error) {
      throw new Error(`Failed to get account tickets by issue type: ${error.message}`);
    }
  }

  async assignTicket(id, assignedTo) {
    try {
      const ticket = await this.accountSupportRepository.findById(id);
      if (!ticket) {
        throw new Error('Account support ticket not found');
      }

      return await this.accountSupportRepository.update(id, {
        assignedTo,
        status: ticket.status === 'pending' ? 'in_progress' : ticket.status
      });
    } catch (error) {
      throw new Error(`Failed to assign ticket: ${error.message}`);
    }
  }

  async resolveTicket(id, resolutionNotes) {
    try {
      const ticket = await this.accountSupportRepository.findById(id);
      if (!ticket) {
        throw new Error('Account support ticket not found');
      }

      return await this.accountSupportRepository.update(id, {
        status: 'resolved',
        resolutionNotes,
        resolvedAt: new Date()
      });
    } catch (error) {
      throw new Error(`Failed to resolve ticket: ${error.message}`);
    }
  }
}

module.exports = AccountSupportService;