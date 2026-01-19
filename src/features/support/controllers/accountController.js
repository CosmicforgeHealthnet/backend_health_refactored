// ===================================
// controllers/support/accountController.js
// ===================================
const AccountSupportService = require('../services/accountService');

class AccountController {
  constructor() {
    this.accountSupportService = new AccountSupportService();
  }

  async getAccountTickets(req, res) {
    try {
      const { status, issueType, assignedTo, priority } = req.query;

      let tickets;

      if (status) {
        tickets = await this.accountSupportService.getAccountTicketsByStatus(status);
      } else if (issueType) {
        tickets = await this.accountSupportService.getAccountTicketsByIssueType(issueType);
      } else {
        tickets = await this.accountSupportService.getAllAccountTickets();
      }

      // Apply additional filters
      if (assignedTo) {
        tickets = tickets.filter(ticket => ticket.assignedTo === assignedTo);
      }

      if (priority) {
        tickets = tickets.filter(ticket => ticket.priority === priority);
      }

      res.json({
        success: true,
        data: tickets,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getAccountTicket(req, res) {
    try {
      const { id } = req.params;
      const ticket = await this.accountSupportService.getAccountTicketById((id));
      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  async createAccountTicket(req, res) {
    try {
      const {
        userId,
        issueType,
        description,
        screenshotUrl,
        priority,
      } = req.body;

      const ticket = await this.accountSupportService.createAccountTicket({
        userId,
        issueType,
        description,
        screenshotUrl,
        priority
      });

      res.status(201).json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateAccountTicket(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const ticket = await this.accountSupportService.updateAccountTicket((id), updateData);
      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getUserAccountTickets(req, res) {
    try {
      const { userId } = req.params;
      const { status, page = 1, limit = 20 } = req.query;

      let tickets = await this.accountSupportService.getUserAccountTickets((userId));

      // Apply status filter
      if (status) {
        tickets = tickets.filter(ticket => ticket.status === status);
      }

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + (limit);
      const paginatedTickets = tickets.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: paginatedTickets,
        pagination: {
          currentPage: (page),
          totalPages: Math.ceil(tickets.length / limit),
          totalItems: tickets.length,
          itemsPerPage: (limit),
          hasNextPage: endIndex < tickets.length,
          hasPreviousPage: page > 1
        }
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  async assignTicket(req, res) {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;

      const ticket = await this.accountSupportService.assignTicket((id), assignedTo);
      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async resolveTicket(req, res) {
    try {
      const { id } = req.params;
      const { resolutionNotes } = req.body;

      const ticket = await this.accountSupportService.resolveTicket((id), resolutionNotes);
      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = AccountController;