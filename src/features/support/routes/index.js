// routes/insuranceRoutes.js
const express = require("express");
const InsuranceController = require("../controllers/insuranceController");
const ReportController = require("../controllers/reportController");
const DisputeController = require("../controllers/disputeController");
const AccountController = require("../controllers/accountController");

const UserSupportController = require("../controllers/userSupportController");

const {
  // Account validators
  validateCreateAccountTicket,
  validateUpdateAccountTicket,
  validateAssignTicket,
  validateResolveTicket,

  // Insurance validators
  validateCreateInsurance,
  validateUpdateInsurance,

  // Report validators
  validateCreateReport,
  validateUpdateReport,

  // Dispute validators
  validateCreateDispute,
  validateUpdateDispute,

  // Common validators
  validateIdParam,
  validateUserIdParam,
  validateSupportRequest, // Added this validator

  // Filter validators
  validateAccountFilters,
  validateInsuranceFilters,
  validateReportFilters,
  validateDisputeFilters,
} = require("../middlewares/supportValidationMiddleware"); // Updated path

const router = express.Router();
const insuranceController = new InsuranceController();
const disputeController = new DisputeController();
const reportController = new ReportController();
const accountController = new AccountController();
const userSupportController = new UserSupportController();

// ===================================
// USER SUPPORT DASHBOARD ROUTES
// ===================================

// GET /user/:userId/dashboard - Get user's complete support dashboard
router.get(
  "/user/:userId/dashboard",
  validateUserIdParam,
  userSupportController.getUserSupportDashboard.bind(userSupportController)
);


// GET /user/:userId/activity - Get user's support activity/history
router.get(
  "/user/:userId/activity",
  validateUserIdParam,
  userSupportController.getUserSupportActivity.bind(userSupportController)
);

// GET /user/:userId/:ticketType/:ticketId - Get specific ticket details
router.get(
  "/user/:userId/:ticketType/:ticketId",
  validateUserIdParam,
  validateIdParam,
  userSupportController.getTicketDetails.bind(userSupportController)
);

// ===================================
// ACCOUNT SUPPORT ROUTES
// ===================================

// GET /account - Get all account tickets with optional filters
router.get(
  "/account",
  validateAccountFilters,
  accountController.getAccountTickets.bind(accountController)
);

// GET /account/:id - Get specific account ticket
router.get(
  "/account/:id",
  validateIdParam,
  accountController.getAccountTicket.bind(accountController)
);

// POST /account - Create new account ticket
router.post(
  "/account",
  validateCreateAccountTicket,
  accountController.createAccountTicket.bind(accountController)
);

// PUT /account/:id - Update account ticket
router.put(
  "/account/:id",
  validateIdParam,
  validateUpdateAccountTicket,
  accountController.updateAccountTicket.bind(accountController)
);

// GET /account/user/:userId - Get user's account tickets
router.get(
  "/account/user/:userId",
  validateUserIdParam,
  accountController.getUserAccountTickets.bind(accountController)
);

// POST /account/:id/assign - Assign account ticket to support agent
router.post(
  "/account/:id/assign",
  validateIdParam,
  validateAssignTicket,
  accountController.assignTicket.bind(accountController)
);

// POST /account/:id/resolve - Mark account ticket as resolved
router.post(
  "/account/:id/resolve",
  validateIdParam,
  validateResolveTicket,
  accountController.resolveTicket.bind(accountController)
);

// ===================================
// INSURANCE SUPPORT ROUTES
// ===================================

// GET /insurance - Get all insurance tickets with optional filters
router.get(
  "/insurance",
  validateInsuranceFilters,
  insuranceController.getInsuranceTickets.bind(insuranceController)
);

// GET /insurance/:id - Get specific insurance ticket
router.get(
  "/insurance/:id",
  validateIdParam,
  insuranceController.getInsuranceTicket.bind(insuranceController)
);

// POST /insurance - Create new insurance ticket
router.post(
  "/insurance",
  validateCreateInsurance,
  insuranceController.createInsuranceTicket.bind(insuranceController)
);

// PUT /insurance/:id - Update insurance ticket
router.put(
  "/insurance/:id",
  validateIdParam,
  validateUpdateInsurance,
  insuranceController.updateInsuranceTicket.bind(insuranceController)
);

// GET /insurance/user/:userId - Get user's insurance tickets
router.get(
  "/insurance/user/:userId",
  validateUserIdParam,
  insuranceController.getUserInsuranceTickets.bind(insuranceController)
);

// ===================================
// REPORT ROUTES
// ===================================

// GET /reports - Get all reports with optional filters
router.get(
  "/reports",
  validateReportFilters,
  reportController.getReports.bind(reportController)
);

// GET /reports/:id - Get specific report
router.get(
  "/reports/:id",
  validateIdParam,
  reportController.getReport.bind(reportController)
);

// POST /reports - Create new report
router.post(
  "/reports",
  validateCreateReport,
  reportController.createReport.bind(reportController)
);

// PUT /reports/:id - Update report
router.put(
  "/reports/:id",
  validateIdParam,
  validateUpdateReport,
  reportController.updateReport.bind(reportController)
);

// GET /reports/user/:userId - Get user's reports
router.get(
  "/reports/user/:userId",
  validateUserIdParam,
  reportController.getUserReports.bind(reportController)
);

// ===================================
// DISPUTE ROUTES
// ===================================

// GET /disputes - Get all disputes with optional filters
router.get(
  "/disputes",
  validateDisputeFilters,
  disputeController.getDisputes.bind(disputeController)
);

// GET /disputes/:id - Get specific dispute
router.get(
  "/disputes/:id",
  validateIdParam,
  disputeController.getDispute.bind(disputeController)
);

// POST /disputes - Create new dispute
router.post(
  "/disputes",
  validateCreateDispute,
  disputeController.createDispute.bind(disputeController)
);

// PUT /disputes/:id - Update dispute
router.put(
  "/disputes/:id",
  validateIdParam,
  validateUpdateDispute,
  disputeController.updateDispute.bind(disputeController)
);

// GET /disputes/user/:userId - Get user's disputes
router.get(
  "/disputes/user/:userId",
  validateUserIdParam,
  disputeController.getUserDisputes.bind(disputeController)
);

module.exports = router;
