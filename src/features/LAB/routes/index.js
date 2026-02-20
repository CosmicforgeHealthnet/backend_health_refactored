// src/routes/labRoutes.js
const express = require("express");
const router = express.Router();
const labFacilityController = require("../controllers/lab_facility");
const labPersonnelController = require("../controllers/lab_personnel");
const labOrderController = require("../controllers/lab_order");
const walletController = require("../controllers/wallet");

const {
  authorizeRoles,
  authenticateJWT,
} = require("../../../shared/middlewares/authMiddleware");
const { USER_ROLES } = require("../../../shared/utils/constants");
const {
  validateLabFacilityRegistration,
  validatePersonnelInvitation,
  validateOrderCreation,
  validateOrderReview,
  validatePersonnelAssignment,
} = require("../validators/index");

// Subscription middlewares
const requireFeature = require("../../subscriptions/middlewares/requireFeature");


// ==================== PUBLIC FACILITY ROUTES ====================

/**
 * Register a new lab facility (no auth required)
 * Anyone can register a facility, but it requires admin approval
 */
router.post(
  "/facilities/register",
  validateLabFacilityRegistration,
  labFacilityController.registerFacility
);

// Step-by-step registration
router.post("/facilities/register/step1", labFacilityController.registerStep1);
router.put("/facilities/register/step2/:id", labFacilityController.registerStep2);  
router.put("/facilities/register/step3/:id", labFacilityController.registerStep3);


/**
 * Get facility details by ID (public for search/reference)
 */
router.get("/facilities/:id", labFacilityController.getFacilityById);

/**
 * Search facilities (public)
 */
router.get("/facilities/search", labFacilityController.searchFacilities);

/**
 * Get facilities by location (public)
 */
router.get(
  "/facilities/location",
  labFacilityController.getFacilitiesByLocation
);

// ==================== LAB ADMIN FACILITY ROUTES ====================

/**
 * Get facilities managed by current lab admin (requires auth)
 */
router.get(
  "/facilities/my/managed",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN),
  labFacilityController.getMyFacilities
);

/**
 * Update facility information (lab admin only)
 */
router.put(
  "/facilities/:id",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN),
  labFacilityController.updateFacility
);

// ==================== PLATFORM ADMIN ROUTES ====================

/**
 * Get pending facility registrations (platform admin only)
 */
router.get(
  "/admin/facilities/pending",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labFacilityController.getPendingFacilities
);

/**
 * Approve facility registration (platform admin only)
 */
router.put(
  "/admin/facilities/:id/approve",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labFacilityController.approveFacility
);

/**
 * Reject facility registration (platform admin only)
 */
router.put(
  "/admin/facilities/:id/reject",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labFacilityController.rejectFacility
);

/**
 * Get facility statistics (platform admin only)
 */
router.get(
  "/admin/facilities/stats",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labFacilityController.getFacilityStats
);

/**
 * Get recent facility registrations (platform admin only)
 */
router.get(
  "/admin/facilities/recent",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labFacilityController.getRecentRegistrations
);

// ==================== PERSONNEL MANAGEMENT ROUTES ====================

/**
 * Invite personnel to facility (lab admin only)
 */
router.post(
  "/facilities/:facilityId/personnel/invite",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN),
  validatePersonnelInvitation,
  labPersonnelController.invitePersonnel
);

/**
 * Get facility personnel (lab admin only)
 */
router.get(
  "/facilities/:facilityId/personnel",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN),
  labPersonnelController.getFacilityPersonnel
);

/**
 * Get personnel statistics for facility (lab admin only)
 */
router.get(
  "/facilities/:facilityId/personnel/stats",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN),
  labPersonnelController.getPersonnelStats
);

/**
 * Get specific personnel details (lab admin only)
 */
router.get(
  "/personnel/:id",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN),
  labPersonnelController.getPersonnelById
);

/**
 * Update personnel status (lab admin only)
 */
router.put(
  "/personnel/:id/status",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN),
  labPersonnelController.updatePersonnelStatus
);

/**
 * Update personnel role (lab admin only)
 */
router.put(
  "/personnel/:id/role",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN),
  labPersonnelController.updatePersonnelRole
);

/**
 * Remove personnel from facility (lab admin only)
 */
router.delete(
  "/personnel/:id",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN),
  labPersonnelController.removePersonnel
);

/**
 * Get current user's personnel roles across all facilities (requires auth)
 */
router.get(
  "/personnel/my/roles",
  authenticateJWT,
  labPersonnelController.getMyPersonnelRoles
);

// ==================== PERSONNEL REGISTRATION ROUTES ====================

/**
 * Get registration token info (public - for registration form)
 * This helps the frontend show the registration form with pre-filled info
 */
router.get(
  "/personnel/registration/:token",
  labPersonnelController.getRegistrationTokenInfo
);

/**
 * Complete personnel registration (public - with token)
 * This is where invited personnel create their user accounts
 */
router.post("/personnel/register", labPersonnelController.completeRegistration);

// ==================== PATIENT ORDER ROUTES ====================

/**
 * Create a new lab order (Patient only)
 * Requires labAccess feature from subscription
 */
router.post(
  "/orders",
  authenticateJWT,
  authorizeRoles(USER_ROLES.PATIENT, USER_ROLES.SUPER_ADMIN),
  requireFeature("labAccess"),
  validateOrderCreation,
  labOrderController.createOrder
);

/**
 * Get patient's own orders
 */
router.get(
  "/orders/my/patient",
  authenticateJWT,
  labOrderController.getMyPatientOrders
);

/**
 * Get specific order details (Patient/Personnel/Lab Admin)
 */
router.get("/orders/:id", authenticateJWT, labOrderController.getOrderById);

/**
 * Cancel order (Patient/Lab Admin)
 */
router.delete("/orders/:id", authenticateJWT, labOrderController.cancelOrder);

// ==================== LAB ADMIN ORDER ROUTES ====================

/**
 * Get all orders for a facility (Lab Admin)
 */
router.get(
  "/facilities/:facilityId/orders",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN),
  labOrderController.getFacilityOrders
);

/**
 * Review order and send invoice (Lab Admin)
 */
router.put(
  "/orders/:id/review",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN),
  validateOrderReview,
  labOrderController.reviewOrderAndSendInvoice
);

/**
 * Assign personnel to order (Lab Admin)
 */
router.put(
  "/orders/:id/assign",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN),
  validatePersonnelAssignment,
  labOrderController.assignPersonnel
);

// ==================== PERSONNEL WORKFLOW ROUTES ====================

/**
 * Get orders assigned to current personnel
 */
router.get(
  "/orders/my/assignments",
  authenticateJWT,
  labOrderController.getMyAssignments
);

/**
 * Schedule appointment/collection (Assigned Personnel)
 */
router.put(
  "/orders/:id/schedule",
  authenticateJWT,
  labOrderController.scheduleAppointment
);

/**
 * Complete sample collection/radiology (Assigned Personnel)
 */
router.put(
  "/orders/:id/complete-collection",
  authenticateJWT,
  labOrderController.completeCollection
);

/**
 * Start processing tests (Lab Technician)
 */
router.put(
  "/orders/:id/start-processing",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN,USER_ROLES.LAB_TECHNICIAN),

  labOrderController.startProcessing
);

/**
 * Upload test results (Lab Technician)
 */
router.put(
  "/orders/:id/upload-results",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN,USER_ROLES.LAB_TECHNICIAN),

  labOrderController.uploadResults
);

/**
 * Review and approve results (Result Reviewer)
 */
router.put(
  "/orders/:id/review-results",
  authenticateJWT,
  authorizeRoles(USER_ROLES.LAB_ADMIN, USER_ROLES.SUPER_ADMIN,USER_ROLES.RESULT_REVIEWER),
  labOrderController.reviewResults
);

// ==================== SEARCH AND ANALYTICS ROUTES ====================

/**
 * Search orders
 */
router.get("/orders/search", authenticateJWT, labOrderController.searchOrders);

/**
 * Get order statistics
 */
router.get(
  "/orders/statistics",
  authenticateJWT,
  labOrderController.getOrderStatistics
);

// ==================== PAYMENT ROUTES ====================

/**
 * Confirm payment (Internal/Webhook - might need different auth)
 */
router.put(
  "/orders/:id/payment/confirm",
  // authenticateJWT, // You might want API key auth for webhooks instead
  labOrderController.confirmPayment
);



// ==================== USER WALLET ROUTES ====================

/**
 * Get user's wallet
 */
router.get(
  "/wallet/my",
  authenticateJWT,
  walletController.getMyWallet
);

/**
 * Create wallet for user
 */
router.post(
  "/wallet/create",
  authenticateJWT,
  walletController.createWallet
);

/**
 * Get wallet transaction history
 */
router.get(
  "/wallet/my/transactions",
  authenticateJWT,
  walletController.getMyTransactions
);

/**
 * Get wallet statistics
 */
router.get(
  "/wallet/my/stats",
  authenticateJWT,
  walletController.getMyWalletStats
);

/**
 * Create wallet top-up
 */
router.post(
  "/wallet/topup",
  authenticateJWT,
  walletController.createTopUp
);

/**
 * Set wallet PIN
 */
router.put(
  "/wallet/my/pin",
  authenticateJWT,
  walletController.setWalletPin
);

/**
 * Verify wallet PIN
 */
router.post(
  "/wallet/my/verify-pin",
  authenticateJWT,
  walletController.verifyWalletPin
);

/**
 * Transfer money between wallets
 */
router.post(
  "/wallet/transfer",
  authenticateJWT,
  walletController.transferMoney
);

// ==================== ADMIN ROUTES ====================

/**
 * Search transactions (admin only)
 */
router.get(
  "/wallet/admin/transactions/search",
  authenticateJWT,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  walletController.searchTransactions
);

/**
 * Get system wallet statistics (admin only)
 */
router.get(
  "/wallet/admin/stats",
  authenticateJWT,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  walletController.getSystemWalletStats
);

/**
 * Manually credit wallet (admin only)
 */
router.post(
  "/wallet/admin/credit",
  authenticateJWT,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  walletController.adminCreditWallet
);

// ==================== WEBHOOK ROUTES ====================

/**
 * Process payment webhook (internal)
 */
router.post(
  "/wallet/webhook/payment",
  // Note: In production, add webhook signature verification middleware
  walletController.processPaymentWebhook
);


module.exports = router;