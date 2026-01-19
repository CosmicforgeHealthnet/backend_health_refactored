// ===================================
// Updated UserSupportController (add account support)
// ===================================
const InsuranceService = require('../services/insuranceService');
const ReportService = require('../services/reportService');
const DisputeService = require('../services/disputeService');
const AccountSupportService = require('../services/accountService');

class UserSupportController {
  constructor() {
    this.insuranceService = new InsuranceService();
    this.reportService = new ReportService();
    this.disputeService = new DisputeService();
    this.accountSupportService = new AccountSupportService();
  }

  // Get all support tickets for a user (insurance, reports, disputes, account)
  async getUserSupportDashboard(req, res) {
    try {
      const { userId } = req.params;
      const { includeResolved = false } = req.query;

      // Fetch all support tickets for the user
      const [insuranceTickets, reports, disputes, accountTickets] = await Promise.all([
        this.insuranceService.getUserInsuranceTickets(userId),
        this.reportService.getUserReports(userId),
        this.disputeService.getUserDisputes(userId),
        this.accountSupportService.getUserAccountTickets(userId)
      ]);

      // Filter out resolved tickets if requested
      const filterTickets = (tickets) => {
        if (includeResolved === 'true') return tickets;
        return tickets.filter(ticket =>
          !['resolved', 'closed'].includes(ticket.status)
        );
      };

      const dashboard = {
        summary: {
          totalTickets: insuranceTickets.length + reports.length + disputes.length + accountTickets.length,
          activeTickets: filterTickets([...insuranceTickets, ...reports, ...disputes, ...accountTickets]).length,
          accountIssues: {
            total: accountTickets.length,
            pending: accountTickets.filter(t => t.status === 'pending').length,
            inProgress: accountTickets.filter(t => t.status === 'in_progress').length,
            resolved: accountTickets.filter(t => t.status === 'resolved').length
          },
          insuranceIssues: {
            total: insuranceTickets.length,
            pending: insuranceTickets.filter(t => t.status === 'pending').length,
            inProgress: insuranceTickets.filter(t => t.status === 'in_progress').length,
            resolved: insuranceTickets.filter(t => t.status === 'resolved').length
          },
          reports: {
            total: reports.length,
            pending: reports.filter(r => r.status === 'pending').length,
            underReview: reports.filter(r => r.status === 'under_review').length,
            resolved: reports.filter(r => r.status === 'resolved').length
          },
          disputes: {
            total: disputes.length,
            pending: disputes.filter(d => d.status === 'pending').length,
            underReview: disputes.filter(d => d.status === 'under_review').length,
            resolved: disputes.filter(d => d.status === 'resolved').length
          }
        },
        tickets: {
          account: filterTickets(accountTickets),
          insurance: filterTickets(insuranceTickets),
          reports: filterTickets(reports),
          disputes: filterTickets(disputes)
        }
      };

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  //   // Get user's account tickets only
  //   async getUserAccountTickets(req, res) {
  //     try {
  //       const { userId } = req.params;
  //       const { status, issueType, page = 1, limit = 20 } = req.query;

  //       let tickets = await this.accountSupportService.getUserAccountTickets(userId);

  //       // Apply filters
  //       if (status) {
  //         tickets = tickets.filter(ticket => ticket.status === status);
  //       }

  //       if (issueType) {
  //         tickets = tickets.filter(ticket => ticket.issueType === issueType);
  //       }

  //       // Apply pagination
  //       const startIndex = (page - 1) * limit;
  //       const endIndex = startIndex + parseInt(limit);
  //       const paginatedTickets = tickets.slice(startIndex, endIndex);

  //       res.json({
  //         success: true,
  //         data: paginatedTickets,
  //         pagination: {
  //           currentPage: parseInt(page),
  //           totalPages: Math.ceil(tickets.length / limit),
  //           totalItems: tickets.length,
  //           itemsPerPage: parseInt(limit),
  //           hasNextPage: endIndex < tickets.length,
  //           hasPreviousPage: page > 1
  //         }
  //       });
  //     } catch (error) {
  //       res.status(500).json({
  //         success: false,
  //         message: error.message
  //       });
  //     }
  //   }

  // Get user's support activity/history (updated to include account)
  async getUserSupportActivity(req, res) {
    try {
      const { userId } = req.params;
      const { days = 30 } = req.query;

      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - parseInt(days));

      // Get all user's support activities
      const [insuranceTickets, reports, disputes, accountTickets] = await Promise.all([
        this.insuranceService.getUserInsuranceTickets(userId),
        this.reportService.getUserReports(userId),
        this.disputeService.getUserDisputes(userId),
        this.accountSupportService.getUserAccountTickets(userId)
      ]);

      // Filter by date and create activity timeline
      const activities = [];

      // Add account activities
      accountTickets
        .filter(ticket => new Date(ticket.createdAt) >= dateFrom)
        .forEach(ticket => {
          activities.push({
            id: ticket.id,
            type: 'account',
            action: 'created',
            title: `Account Issue: ${ticket.issueType.replace(/_/g, ' ')}`,
            status: ticket.status,
            priority: ticket.priority,
            date: ticket.createdAt,
            description: ticket.description
          });
        });

      // Add insurance activities
      insuranceTickets
        .filter(ticket => new Date(ticket.createdAt) >= dateFrom)
        .forEach(ticket => {
          activities.push({
            id: ticket.id,
            type: 'insurance',
            action: 'created',
            title: `Insurance Issue: ${ticket.issueType.replace(/_/g, ' ')}`,
            status: ticket.status,
            date: ticket.createdAt,
            description: ticket.description
          });
        });

      // Add report activities
      reports
        .filter(report => new Date(report.createdAt) >= dateFrom)
        .forEach(report => {
          activities.push({
            id: report.id,
            type: 'report',
            action: 'created',
            title: `Report: ${report.issueType.replace(/_/g, ' ')}`,
            status: report.status,
            date: report.createdAt,
            description: report.description,
            provider: report.provider?.name
          });
        });

      // Add dispute activities
      disputes
        .filter(dispute => new Date(dispute.createdAt) >= dateFrom)
        .forEach(dispute => {
          activities.push({
            id: dispute.id,
            type: 'dispute',
            action: 'created',
            title: `Dispute: ${dispute.disputeType.replace(/_/g, ' ')}`,
            status: dispute.status,
            date: dispute.createdAt,
            description: dispute.description,
            amount: dispute.transaction?.amount
          });
        });

      // Sort by date (most recent first)
      activities.sort((a, b) => new Date(b.date) - new Date(a.date));

      res.json({
        success: true,
        data: {
          activities,
          summary: {
            totalActivities: activities.length,
            period: `${days} days`,
            byType: {
              account: activities.filter(a => a.type === 'account').length,
              insurance: activities.filter(a => a.type === 'insurance').length,
              reports: activities.filter(a => a.type === 'report').length,
              disputes: activities.filter(a => a.type === 'dispute').length
            }
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get specific ticket details by ID and type (updated to include account)
  async getTicketDetails(req, res) {
    try {
      const { userId, ticketType, ticketId } = req.params;

      let ticket;

      switch (ticketType) {
        case 'account':
          ticket = await this.accountSupportService.getAccountTicketById((ticketId));
          break;
        case 'insurance':
          ticket = await this.insuranceService.getInsuranceTicketById((ticketId));
          break;
        case 'report':
          ticket = await this.reportService.getReportById((ticketId));
          break;
        case 'dispute':
          ticket = await this.disputeService.getDisputeById((ticketId));
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid ticket type. Must be account, insurance, report, or dispute'
          });
      }

      // Verify ticket belongs to user
      if (ticket.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This ticket does not belong to you.'
        });
      }

      res.json({
        success: true,
        data: ticket
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = UserSupportController;