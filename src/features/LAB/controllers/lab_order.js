// src/controllers/labOrderController.js
const labOrderService = require("../services/lab_order");
const labPersonnelRepository = require("../repositories/lab_personnel");

const { USER_ROLES } = require("../../../shared/utils/constants");

class LabOrderController {
  
  /**
   * Create a new order (Patient)
   * POST /api/lab/orders
   */
  async createOrder(req, res, next) {
    try {
      const { sub: patientId, role } = req.user;
      
      // Only patients can create orders
      if (role !== USER_ROLES.PATIENT) {
        return res.status(403).json({
          success: false,
          error: "Only patients can create lab orders"
        });
      }

      const order = await labOrderService.createOrder(req.body, patientId);

      return res.status(201).json({
        success: true,
        message: "Lab order created successfully. Awaiting facility review.",
        data: order
      });
    } catch (error) {
      if (error.message.includes("not found") || error.message.includes("required") || error.message.includes("not currently accepting")) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get order by ID
   * GET /api/lab/orders/:id
   */
  async getOrderById(req, res, next) {
    try {
      const { id } = req.params;
      const { sub: userId } = req.user;
      
      const order = await labOrderService.getOrderById(id);
      
      // Check access rights
      const hasAccess = order.patientId === userId || 
                       (order.facility.adminUser && order.facility.adminUser.id === userId) ||
                       (order.assignedPersonnel && order.assignedPersonnel.user && order.assignedPersonnel.user.id === userId);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: "Access denied to this order"
        });
      }

      return res.json({
        success: true,
        data: order,
        message: "Order retrieved successfully"
      });
    } catch (error) {
      if (error.message === "Order not found") {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get patient's orders
   * GET /api/lab/orders/my/patient
   */
  async getMyPatientOrders(req, res, next) {
    try {
      const { sub: patientId, role } = req.user;
      
      if (role !== USER_ROLES.PATIENT) {
        return res.status(403).json({
          success: false,
          error: "Only patients can view their orders"
        });
      }

      const { limit = 20, offset = 0 } = req.query;
      const orders = await labOrderService.getPatientOrders(patientId, parseInt(limit), parseInt(offset));

      return res.json({
        success: true,
        data: orders,
        count: orders.length,
        message: "Patient orders retrieved successfully"
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get facility orders (Lab Admin)
   * GET /api/lab/facilities/:facilityId/orders
   */
  async getFacilityOrders(req, res, next) {
    try {
      const { facilityId } = req.params;
      const { sub: userId, role } = req.user;
      const { limit = 50, offset = 0 } = req.query;

      if (role !== USER_ROLES.LAB_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Only lab administrators can view facility orders"
        });
      }

      const orders = await labOrderService.getFacilityOrders(facilityId, userId, parseInt(limit), parseInt(offset));

      return res.json({
        success: true,
        data: orders,
        count: orders.length,
        message: "Facility orders retrieved successfully"
      });
    } catch (error) {
      if (error.message.includes("Access denied")) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Review order and send invoice (Lab Admin)
   * PUT /api/lab/orders/:id/review
   */
  async reviewOrderAndSendInvoice(req, res, next) {
    try {
      const { id } = req.params;
      const { sub: userId, role } = req.user;
      
      if (role !== USER_ROLES.LAB_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Only lab administrators can review orders"
        });
      }

      const order = await labOrderService.reviewOrderAndSendInvoice(id, req.body, userId);

      return res.json({
        success: true,
        data: order,
        message: "Order reviewed and invoice sent to patient"
      });
    } catch (error) {
      if (error.message.includes("not found") || error.message.includes("cannot be reviewed") || error.message.includes("Access denied")) {
        const statusCode = error.message.includes("not found") ? 404 : 
                          error.message.includes("Access denied") ? 403 : 400;
        return res.status(statusCode).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Confirm payment (Internal/Webhook)
   * PUT /api/lab/orders/:id/payment/confirm
   */
  async confirmPayment(req, res, next) {
    try {
      const { id } = req.params;
      const order = await labOrderService.confirmPayment(id, req.body);

      return res.json({
        success: true,
        data: order,
        message: "Payment confirmed successfully"
      });
    } catch (error) {
      if (error.message.includes("not found") || error.message.includes("not awaiting payment")) {
        const statusCode = error.message.includes("not found") ? 404 : 400;
        return res.status(statusCode).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Assign personnel to order (Lab Admin)
   * PUT /api/lab/orders/:id/assign
   */
  async assignPersonnel(req, res, next) {
    try {
      const { id } = req.params;
      const { personnelId } = req.body;
      const { sub: userId, role } = req.user;
      
      if (role !== USER_ROLES.LAB_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Only lab administrators can assign personnel"
        });
      }

      if (!personnelId) {
        return res.status(400).json({
          success: false,
          error: "Personnel ID is required"
        });
      }

      const order = await labOrderService.assignPersonnelToOrder(id, personnelId, userId);

      return res.json({
        success: true,
        data: order,
        message: "Personnel assigned successfully"
      });
    } catch (error) {
      if (error.message.includes("not found") || error.message.includes("must be paid") || error.message.includes("cannot handle")) {
        const statusCode = error.message.includes("not found") ? 404 : 400;
        return res.status(statusCode).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Schedule appointment (Assigned Personnel)
   * PUT /api/lab/orders/:id/schedule
   */
  async scheduleAppointment(req, res, next) {
    try {
      const { id } = req.params;
      const { scheduledDateTime } = req.body;
      const { sub: userId } = req.user;

      if (!scheduledDateTime) {
        return res.status(400).json({
          success: false,
          error: "Scheduled date and time is required"
        });
      }

      // Get personnel ID from user ID
      const personnelId = await this.getPersonnelIdFromUserId(userId);
      if (!personnelId) {
        return res.status(403).json({
          success: false,
          error: "Only assigned personnel can schedule appointments"
        });
      }

      const order = await labOrderService.scheduleAppointment(id, new Date(scheduledDateTime), personnelId);

      return res.json({
        success: true,
        data: order,
        message: "Appointment scheduled successfully"
      });
    } catch (error) {
      if (error.message.includes("Only assigned") || error.message.includes("must be assigned")) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Complete collection/radiology (Assigned Personnel)
   * PUT /api/lab/orders/:id/complete-collection
   */
  async completeCollection(req, res, next) {
    try {
      const { id } = req.params;
      const { sub: userId } = req.user;

      const personnelId = await this.getPersonnelIdFromUserId(userId);
      if (!personnelId) {
        return res.status(403).json({
          success: false,
          error: "Only assigned personnel can complete collection"
        });
      }

      const order = await labOrderService.completeCollection(id, personnelId, req.body);

      return res.json({
        success: true,
        data: order,
        message: "Collection completed successfully"
      });
    } catch (error) {
      if (error.message.includes("Only assigned") || error.message.includes("cannot be completed")) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Start processing (Lab Technician)
   * PUT /api/lab/orders/:id/start-processing
   */
  async startProcessing(req, res, next) {
    try {
      const { id } = req.params;
      const { sub: userId, role } = req.user;

      if (role !== USER_ROLES.LAB_TECHNICIAN) {
        return res.status(403).json({
          success: false,
          error: "Only lab technicians can start processing"
        });
      }

      const personnelId = await this.getPersonnelIdFromUserId(userId);
      const order = await labOrderService.startProcessing(id, personnelId);

      return res.json({
        success: true,
        data: order,
        message: "Processing started successfully"
      });
    } catch (error) {
      if (error.message.includes("must be collected")) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Upload test results (Lab Technician)
   * PUT /api/lab/orders/:id/upload-results
   */
  async uploadResults(req, res, next) {
    try {
      const { id } = req.params;
      const { sub: userId, role } = req.user;

      if (role !== USER_ROLES.LAB_TECHNICIAN) {
        return res.status(403).json({
          success: false,
          error: "Only lab technicians can upload results"
        });
      }

      const personnelId = await this.getPersonnelIdFromUserId(userId);
      const order = await labOrderService.uploadResults(id, req.body, personnelId);

      return res.json({
        success: true,
        data: order,
        message: "Results uploaded successfully"
      });
    } catch (error) {
      if (error.message.includes("must be in processing")) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Review and approve results (Result Reviewer)
   * PUT /api/lab/orders/:id/review-results
   */
  async reviewResults(req, res, next) {
    try {
      const { id } = req.params;
      const { sub: userId, role } = req.user;

      if (role !== USER_ROLES.RESULT_REVIEWER) {
        return res.status(403).json({
          success: false,
          error: "Only result reviewers can review results"
        });
      }

      const personnelId = await this.getPersonnelIdFromUserId(userId);
      const order = await labOrderService.reviewResults(id, req.body, personnelId);

      const message = req.body.approved ? "Results approved and sent to patient" : "Results sent back for revision";

      return res.json({
        success: true,
        data: order,
        message
      });
    } catch (error) {
      if (error.message.includes("must be ready")) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get personnel orders (Personnel dashboard)
   * GET /api/lab/orders/my/assignments
   */
  async getMyAssignments(req, res, next) {
    try {
      const { sub: userId } = req.user;

      const personnelId = await this.getPersonnelIdFromUserId(userId);
      if (!personnelId) {
        return res.status(403).json({
          success: false,
          error: "Only lab personnel can view assignments"
        });
      }

      const orders = await labOrderService.getPersonnelOrders(personnelId);

      return res.json({
        success: true,
        data: orders,
        count: orders.length,
        message: "Assigned orders retrieved successfully"
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search orders
   * GET /api/lab/orders/search
   */
  async searchOrders(req, res, next) {
    try {
      const { q, facilityId } = req.query;
      const { sub: userId } = req.user;

      if (!q) {
        return res.status(400).json({
          success: false,
          error: "Search query 'q' is required"
        });
      }

      const orders = await labOrderService.searchOrders(q, facilityId, userId);

      return res.json({
        success: true,
        data: orders,
        count: orders.length,
        message: "Search results retrieved successfully"
      });
    } catch (error) {
      if (error.message.includes("Access denied")) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get order statistics
   * GET /api/lab/orders/statistics
   */
  async getOrderStatistics(req, res, next) {
    try {
      const { facilityId } = req.query;
      const { sub: userId } = req.user;

      const stats = await labOrderService.getOrderStatistics(facilityId, userId);

      return res.json({
        success: true,
        data: stats,
        message: "Order statistics retrieved successfully"
      });
    } catch (error) {
      if (error.message.includes("Access denied")) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Cancel order
   * DELETE /api/lab/orders/:id
   */
  async cancelOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const { sub: userId } = req.user;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: "Cancellation reason is required"
        });
      }

      const order = await labOrderService.cancelOrder(id, reason, userId);

      return res.json({
        success: true,
        data: order,
        message: "Order cancelled successfully"
      });
    } catch (error) {
      if (error.message.includes("Cannot cancel")) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  // Utility method to get personnel ID from user ID
  async getPersonnelIdFromUserId(userId) {
    // This is a simplified approach - in practice you might want to cache this
    const personnel = await labPersonnelRepository.findByUserId(userId);
    return personnel.length > 0 ? personnel[0].id : null;
  }
}

module.exports = new LabOrderController();