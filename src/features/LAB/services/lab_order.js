
// // src/services/labOrderService.js
// const labOrderRepository = require("../repositories/lab_order");
// const labOrderItemRepository = require("../repositories/lab_order_item");
// const labFacilityRepository = require("../repositories/lab_facility");
// const labPersonnelRepository = require("../repositories/lab_personnel");
// const userRepository = require("../../auth/repositories/userRepository");
// const { USER_ROLES } = require("../../../shared/utils/constants");
// const crypto = require("node:crypto");

// class LabOrderService {
  
//   /**
//    * Create a new lab order by patient
//    */
//   async createOrder(orderData, patientId) {
//     // Validate patient exists
//     const patient = await userRepository.findById(patientId);
//     if (!patient) {
//       throw new Error("Patient not found");
//     }

//     // Validate facility exists and is active
//     const facility = await labFacilityRepository.findById(orderData.facilityId);
//     if (!facility) {
//       throw new Error("Lab facility not found");
//     }
//     if (facility.status !== "active") {
//       throw new Error("Lab facility is not currently accepting orders");
//     }

//     // Validate required fields
//     this.validateOrderData(orderData);

//     // Generate unique order number
//     const orderNumber = await labOrderRepository.generateOrderNumber();

//     // Determine order type based on tests
//     const orderType = this.determineOrderType(orderData.tests);

//     // Create order
//     const order = labOrderRepository.create({
//       orderNumber,
//       patientId,
//       facilityId: orderData.facilityId,
//       orderType,
//       serviceType: orderData.serviceType || "lab_visit",
//       status: "created",
//       testNames: orderData.tests.map(t => t.name),
//       patientInstructions: orderData.patientInstructions,
//       doctorReferral: orderData.doctorReferral,
//       medicalHistory: orderData.medicalHistory,
//       preferredDate: orderData.preferredDate,
//       preferredTime: orderData.preferredTime,
//       collectionAddress: orderData.serviceType === "home_collection" ? orderData.collectionAddress : null,
//       urgentProcessing: orderData.urgentProcessing || false
//     });

//     const savedOrder = await labOrderRepository.save(order);

//     // Create order items
//     await labOrderItemRepository.createOrderItems(savedOrder.id, orderData.tests);

//     // Create chat room for order communication
//     // await this.createOrderChatRoom(savedOrder.id);

//     return this.getOrderById(savedOrder.id);
//   }

//   /**
//    * Get order by ID with full details
//    */
//   async getOrderById(orderId) {
//     const order = await labOrderRepository.findById(orderId);
//     if (!order) {
//       throw new Error("Order not found");
//     }
//     return order;
//   }

//   /**
//    * Get orders for a patient
//    */
//   async getPatientOrders(patientId, limit = 20, offset = 0) {
//     return labOrderRepository.findByPatientId(patientId, limit, offset);
//   }

//   /**
//    * Get orders for a facility (Lab Admin access)
//    */
//   async getFacilityOrders(facilityId, requestingUserId, limit = 50, offset = 0) {
//     // Verify user has access to this facility
//     await this.verifyFacilityAccess(facilityId, requestingUserId);
    
//     return labOrderRepository.findByFacilityId(facilityId, limit, offset);
//   }

//   /**
//    * Lab Admin reviews order and sends payment invoice
//    */
//   async reviewOrderAndSendInvoice(orderId, invoiceData, labAdminId) {
//     const order = await labOrderRepository.findById(orderId);
//     if (!order) {
//       throw new Error("Order not found");
//     }

//     if (order.status !== "created") {
//       throw new Error("Order cannot be reviewed in current status");
//     }

//     // Verify lab admin has access
//     await this.verifyFacilityAccess(order.facilityId, labAdminId);

//     // Calculate costs
//     const pricing = this.calculateOrderPricing(order, invoiceData);

//     // Update order with pricing and invoice status
//     await labOrderRepository.updateStatus(orderId, "pending_payment", {
//       baseAmount: pricing.baseAmount,
//       homeVisitFee: pricing.homeVisitFee,
//       urgentFee: pricing.urgentFee,
//       totalAmount: pricing.totalAmount,
//       currency: pricing.currency,
//       invoiceSentAt: new Date()
//     });

//     // Send invoice email to patient
//     try {
//       await this.sendInvoiceEmail(order, pricing);
//     } catch (emailError) {
//       console.error("Failed to send invoice email:", emailError);
//     }

//     return this.getOrderById(orderId);
//   }

//   /**
//    * Process payment confirmation (called by payment webhook/service)
//    */
//   async confirmPayment(orderId, paymentData) {
//     const order = await labOrderRepository.findById(orderId);
//     if (!order) {
//       throw new Error("Order not found");
//     }

//     if (order.status !== "pending_payment") {
//       throw new Error("Order is not awaiting payment");
//     }

//     await labOrderRepository.updatePaymentInfo(orderId, {
//       paymentStatus: "paid",
//       ...paymentData
//     });

//     // Send payment confirmation email
//     try {
//       await this.sendPaymentConfirmationEmail(order, paymentData);
//     } catch (emailError) {
//       console.error("Failed to send payment confirmation email:", emailError);
//     }

//     return this.getOrderById(orderId);
//   }

//   /**
//    * Assign personnel to order (Lab Admin)
//    */
//   async assignPersonnelToOrder(orderId, personnelId, labAdminId) {
//     const order = await labOrderRepository.findById(orderId);
//     if (!order) {
//       throw new Error("Order not found");
//     }

//     if (order.status !== "payment_confirmed") {
//       throw new Error("Order must be paid before personnel assignment");
//     }

//     // Verify lab admin access
//     await this.verifyFacilityAccess(order.facilityId, labAdminId);

//     // Verify personnel belongs to facility and has appropriate role
//     const personnel = await labPersonnelRepository.findById(personnelId);
//     if (!personnel || personnel.facility.id !== order.facilityId) {
//       throw new Error("Personnel not found or not associated with this facility");
//     }

//     // Verify personnel role matches order type
//     const requiredRoles = this.getRequiredPersonnelRoles(order.orderType);
//     if (!requiredRoles.includes(personnel.role)) {
//       throw new Error(`Personnel role ${personnel.role} cannot handle ${order.orderType} orders`);
//     }

//     await labOrderRepository.assignPersonnel(orderId, personnelId);

//     // Send assignment notification emails
//     try {
//       await this.sendAssignmentNotificationEmails(order, personnel);
//     } catch (emailError) {
//       console.error("Failed to send assignment notification emails:", emailError);
//     }

//     return this.getOrderById(orderId);
//   }

//   /**
//    * Schedule appointment/collection (Personnel)
//    */
//   async scheduleAppointment(orderId, scheduledDateTime, personnelId) {
//     const order = await labOrderRepository.findById(orderId);
//     if (!order) {
//       throw new Error("Order not found");
//     }

//     if (order.assignedPersonnelId !== personnelId) {
//       throw new Error("Only assigned personnel can schedule appointments");
//     }

//     if (order.status !== "assigned") {
//       throw new Error("Order must be assigned before scheduling");
//     }

//     await labOrderRepository.scheduleAppointment(orderId, scheduledDateTime);

//     // Send scheduling confirmation emails
//     try {
//       await this.sendSchedulingConfirmationEmails(order, scheduledDateTime);
//     } catch (emailError) {
//       console.error("Failed to send scheduling confirmation emails:", emailError);
//     }

//     return this.getOrderById(orderId);
//   }

//   /**
//    * Mark collection/radiology as completed (Personnel)
//    */
//   async completeCollection(orderId, personnelId, completionData = {}) {
//     const order = await labOrderRepository.findById(orderId);
//     if (!order) {
//       throw new Error("Order not found");
//     }

//     if (order.assignedPersonnelId !== personnelId) {
//       throw new Error("Only assigned personnel can complete collection");
//     }

//     if (!["assigned", "scheduled", "in_progress"].includes(order.status)) {
//       throw new Error("Order cannot be completed in current status");
//     }

//     await labOrderRepository.updateStatus(orderId, "sample_collected", completionData);

//     // Notify lab technicians that samples are ready for processing
//     try {
//       await this.notifyLabTechnicians(order);
//     } catch (emailError) {
//       console.error("Failed to notify lab technicians:", emailError);
//     }

//     return this.getOrderById(orderId);
//   }

//   /**
//    * Start processing tests (Lab Technician)
//    */
//   async startProcessing(orderId, technicianId) {
//     const order = await labOrderRepository.findById(orderId);
//     if (!order) {
//       throw new Error("Order not found");
//     }

//     if (order.status !== "sample_collected") {
//       throw new Error("Samples must be collected before processing");
//     }

//     // Verify technician has access to this facility
//     const technician = await this.verifyPersonnelAccess(technicianId, order.facilityId, ["lab_technician"]);

//     await labOrderRepository.updateStatus(orderId, "processing", {
//       processingStartedAt: new Date()
//     });

//     return this.getOrderById(orderId);
//   }

//   /**
//    * Upload test results (Lab Technician)
//    */
//   async uploadResults(orderId, resultsData, technicianId) {
//     const order = await labOrderRepository.findById(orderId);
//     if (!order) {
//       throw new Error("Order not found");
//     }

//     if (order.status !== "processing") {
//       throw new Error("Order must be in processing status");
//     }

//     // Verify technician access
//     await this.verifyPersonnelAccess(technicianId, order.facilityId, ["lab_technician"]);

//     await labOrderRepository.uploadResults(orderId, resultsData);

//     // Update individual order items with results if provided
//     if (resultsData.itemResults) {
//       for (const itemResult of resultsData.itemResults) {
//         await labOrderItemRepository.updateResults(itemResult.itemId, {
//           result: itemResult.result,
//           normalRange: itemResult.normalRange,
//           unit: itemResult.unit,
//           isAbnormal: itemResult.isAbnormal
//         });
//       }
//     }

//     // Notify result reviewers
//     try {
//       await this.notifyResultReviewers(order);
//     } catch (emailError) {
//       console.error("Failed to notify result reviewers:", emailError);
//     }

//     return this.getOrderById(orderId);
//   }

//   /**
//    * Review and approve results (Result Reviewer)
//    */
//   async reviewResults(orderId, reviewData, reviewerId) {
//     const order = await labOrderRepository.findById(orderId);
//     if (!order) {
//       throw new Error("Order not found");
//     }

//     if (order.status !== "results_ready") {
//       throw new Error("Results must be ready for review");
//     }

//     // Verify reviewer access
//     await this.verifyPersonnelAccess(reviewerId, order.facilityId, ["result_reviewer"]);

//     if (reviewData.approved) {
//       await labOrderRepository.updateStatus(orderId, "results_approved", {
//         reviewerId,
//         reviewerNotes: reviewData.notes,
//         reviewCompletedAt: new Date()
//       });

//       // Send results to patient
//       await this.deliverResultsToPatient(order);
//     } else {
//       await labOrderRepository.updateStatus(orderId, "revision_required", {
//         reviewerId,
//         reviewerNotes: reviewData.notes,
//         reviewCompletedAt: new Date()
//       });

//       // Notify technician of required revisions
//       try {
//         await this.notifyTechnicianOfRevisions(order, reviewData.notes);
//       } catch (emailError) {
//         console.error("Failed to notify technician of revisions:", emailError);
//       }
//     }

//     return this.getOrderById(orderId);
//   }

//   /**
//    * Get orders assigned to personnel
//    */
//   async getPersonnelOrders(personnelId) {
//     return labOrderRepository.findByAssignedPersonnel(personnelId);
//   }

//   /**
//    * Search orders
//    */
//   async searchOrders(query, facilityId, requestingUserId) {
//     if (facilityId) {
//       await this.verifyFacilityAccess(facilityId, requestingUserId);
//     }
    
//     return labOrderRepository.searchOrders(query, facilityId);
//   }

//   /**
//    * Get order statistics
//    */
//   async getOrderStatistics(facilityId, requestingUserId) {
//     if (facilityId) {
//       await this.verifyFacilityAccess(facilityId, requestingUserId);
//     }
    
//     return labOrderRepository.getOrderStats(facilityId);
//   }

//   /**
//    * Cancel order
//    */
//   async cancelOrder(orderId, reason, requestingUserId) {
//     const order = await labOrderRepository.findById(orderId);
//     if (!order) {
//       throw new Error("Order not found");
//     }

//     // Only patient or facility admin can cancel
//     if (order.patientId !== requestingUserId) {
//       await this.verifyFacilityAccess(order.facilityId, requestingUserId);
//     }

//     if (["completed", "cancelled"].includes(order.status)) {
//       throw new Error("Cannot cancel order in current status");
//     }

//     await labOrderRepository.cancelOrder(orderId, reason);

//     // Handle refunds if payment was made
//     if (order.paymentStatus === "paid") {
//       // Trigger refund process
//       await this.processRefund(order);
//     }

//     return this.getOrderById(orderId);
//   }

//   // Utility methods
//   validateOrderData(data) {
//     if (!data.facilityId) {
//       throw new Error("Facility ID is required");
//     }
//     if (!data.tests || !Array.isArray(data.tests) || data.tests.length === 0) {
//       throw new Error("At least one test must be specified");
//     }
//     if (data.serviceType === "home_collection" && !data.collectionAddress) {
//       throw new Error("Collection address is required for home collection");
//     }
//   }

//   determineOrderType(tests) {
//     const hasRadiology = tests.some(test => 
//       test.category && test.category.toLowerCase().includes('radiology') ||
//       test.name && ['x-ray', 'mri', 'ct', 'ultrasound', 'mammography'].some(type => 
//         test.name.toLowerCase().includes(type)
//       )
//     );
//     return hasRadiology ? "radiology" : "lab_test";
//   }

//   calculateOrderPricing(order, invoiceData) {
//     let baseAmount = invoiceData.baseAmount || 0;
//     let homeVisitFee = 0;
//     let urgentFee = 0;

//     if (order.serviceType === "home_collection") {
//       homeVisitFee = invoiceData.homeVisitFee || 50;
//     }

//     if (order.urgentProcessing) {
//       urgentFee = invoiceData.urgentFee || (baseAmount * 0.5); // 50% surcharge
//     }

//     const totalAmount = baseAmount + homeVisitFee + urgentFee;

//     return {
//       baseAmount,
//       homeVisitFee,
//       urgentFee,
//       totalAmount,
//       currency: invoiceData.currency || "USD"
//     };
//   }

//   getRequiredPersonnelRoles(orderType) {
//     if (orderType === "radiology") {
//       return ["radiologist"];
//     }
//     return ["sample_collector", "lab_technician"];
//   }

//   async verifyFacilityAccess(facilityId, userId) {
//     const facility = await labFacilityRepository.findById(facilityId);
//     if (!facility) {
//       throw new Error("Facility not found");
//     }

//     if (facility.adminUser && facility.adminUser.id === userId) {
//       return true;
//     }

//     // Check if user is personnel with access to this facility
//     const personnel = await labPersonnelRepository.findByUserId(userId);
//     const hasAccess = personnel.some(p => p.facility.id === facilityId && p.status === "active");
    
//     if (!hasAccess) {
//       throw new Error("Access denied to this facility");
//     }

//     return true;
//   }

//   async verifyPersonnelAccess(personnelId, facilityId, requiredRoles = []) {
//     const personnel = await labPersonnelRepository.findById(personnelId);
//     if (!personnel) {
//       throw new Error("Personnel not found");
//     }

//     if (personnel.facility.id !== facilityId) {
//       throw new Error("Personnel not associated with this facility");
//     }

//     if (personnel.status !== "active") {
//       throw new Error("Personnel is not active");
//     }

//     if (requiredRoles.length > 0 && !requiredRoles.includes(personnel.role)) {
//       throw new Error(`Personnel role ${personnel.role} not authorized for this operation`);
//     }

//     return personnel;
//   }

//   // Email notification methods (placeholders - implement with your email service)
//   async sendInvoiceEmail(order, pricing) {
//     console.log(`Sending invoice email to patient ${order.patient.email} for order ${order.orderNumber}`);
//     // Implementation depends on your email service
//   }

//   async sendPaymentConfirmationEmail(order, paymentData) {
//     console.log(`Sending payment confirmation to ${order.patient.email} for order ${order.orderNumber}`);
//   }

//   async sendAssignmentNotificationEmails(order, personnel) {
//     console.log(`Notifying ${personnel.email} of assignment to order ${order.orderNumber}`);
//     console.log(`Notifying patient ${order.patient.email} of personnel assignment`);
//   }

//   async sendSchedulingConfirmationEmails(order, scheduledDateTime) {
//     console.log(`Sending scheduling confirmation for order ${order.orderNumber} at ${scheduledDateTime}`);
//   }

//   async notifyLabTechnicians(order) {
//     console.log(`Notifying lab technicians that samples are ready for order ${order.orderNumber}`);
//   }

//   async notifyResultReviewers(order) {
//     console.log(`Notifying result reviewers that results are ready for order ${order.orderNumber}`);
//   }

//   async deliverResultsToPatient(order) {
//     await labOrderRepository.updateStatus(order.id, "completed", {
//       resultsDeliveredAt: new Date()
//     });
//     console.log(`Delivering results to patient for order ${order.orderNumber}`);
//   }

//   async notifyTechnicianOfRevisions(order, notes) {
//     console.log(`Notifying technician of required revisions for order ${order.orderNumber}: ${notes}`);
//   }

//   async processRefund(order) {
//     console.log(`Processing refund for order ${order.orderNumber}`);
//     // Implementation depends on your payment service
//   }

//   // Additional utility methods
//   async getOrdersByStatus(status, facilityId = null, requestingUserId = null) {
//     if (facilityId && requestingUserId) {
//       await this.verifyFacilityAccess(facilityId, requestingUserId);
//     }
    
//     return labOrderRepository.findByStatus(status, facilityId);
//   }

//   async getOverdueOrders(facilityId = null, requestingUserId = null) {
//     if (facilityId && requestingUserId) {
//       await this.verifyFacilityAccess(facilityId, requestingUserId);
//     }
    
//     return labOrderRepository.findOverdueOrders(facilityId);
//   }

//   async getRecentOrders(facilityId = null, requestingUserId = null, limit = 10) {
//     if (facilityId && requestingUserId) {
//       await this.verifyFacilityAccess(facilityId, requestingUserId);
//     }
    
//     return labOrderRepository.findRecentOrders(facilityId, limit);
//   }

//   // Update order status (generic method for personnel)
//   async updateOrderStatus(orderId, status, personnelId, additionalData = {}) {
//     const order = await labOrderRepository.findById(orderId);
//     if (!order) {
//       throw new Error("Order not found");
//     }

//     // Verify personnel has access
//     await this.verifyPersonnelAccess(personnelId, order.facilityId);

//     await labOrderRepository.updateStatus(orderId, status, additionalData);
//     return this.getOrderById(orderId);
//   }
// }

// module.exports = new LabOrderService();


// src/services/labOrderService.js (Updated with Chat Integration)

const labOrderRepository = require("../repositories/lab_order");
const labOrderItemRepository = require("../repositories/lab_order_item");
const labFacilityRepository = require("../repositories/lab_facility");
const labPersonnelRepository = require("../repositories/lab_personnel");
const userRepository = require("../../auth/repositories/userRepository");
const LabOrderChatService = require("../services/chat");
const {  ORDER_STATUS } = require("../utils/constants");
const crypto = require("node:crypto");

class LabOrderService {
  constructor() {
    this.labOrderChatService = new LabOrderChatService();
  }
  
  /**
   * Create a new lab order by patient
   */
  async createOrder(orderData, patientId) {
    // Validate patient exists
    const patient = await userRepository.findById(patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    // Validate facility exists and is active
    const facility = await labFacilityRepository.findById(orderData.facilityId);
    if (!facility) {
      throw new Error("Lab facility not found");
    }
    if (facility.status !== "active") {
      throw new Error("Lab facility is not currently accepting orders");
    }

    // Validate required fields
    this.validateOrderData(orderData);

    // Generate unique order number
    const orderNumber = await labOrderRepository.generateOrderNumber();

    // Determine order type based on tests
    const orderType = this.determineOrderType(orderData.tests);

    // Create order
    const order = labOrderRepository.create({
      orderNumber,
      patientId,
      facilityId: orderData.facilityId,
      orderType,
      serviceType: orderData.serviceType || "lab_visit",
      status: ORDER_STATUS.CREATED,
      testNames: orderData.tests.map(t => t.name),
      patientInstructions: orderData.patientInstructions,
      doctorReferral: orderData.doctorReferral,
      medicalHistory: orderData.medicalHistory,
      preferredDate: orderData.preferredDate,
      preferredTime: orderData.preferredTime,
      collectionAddress: orderData.serviceType === "home_collection" ? orderData.collectionAddress : null,
      urgentProcessing: orderData.urgentProcessing || false
    });

    const savedOrder = await labOrderRepository.save(order);

    // Create order items
    await labOrderItemRepository.createOrderItems(savedOrder.id, orderData.tests);

    // Note: Chat room will be created when personnel is assigned (Step 10)

    return this.getOrderById(savedOrder.id);
  }

  /**
   * Lab Admin reviews order and sends payment invoice
   */
  async reviewOrderAndSendInvoice(orderId, invoiceData, labAdminId) {
    const order = await labOrderRepository.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== ORDER_STATUS.CREATED) {
      throw new Error("Order cannot be reviewed in current status");
    }

    // Verify lab admin has access
    await this.verifyFacilityAccess(order.facilityId, labAdminId);

    // Calculate costs
    const pricing = this.calculateOrderPricing(order, invoiceData);

    // Update order with pricing and invoice status
    await labOrderRepository.updateStatus(orderId, ORDER_STATUS.PENDING_PAYMENT, {
      baseAmount: pricing.baseAmount,
      homeVisitFee: pricing.homeVisitFee,
      urgentFee: pricing.urgentFee,
      totalAmount: pricing.totalAmount,
      currency: pricing.currency,
      invoiceSentAt: new Date()
    });

    // Send invoice email to patient
    try {
      await this.sendInvoiceEmail(order, pricing);
    } catch (emailError) {
      console.error("Failed to send invoice email:", emailError);
    }

    return this.getOrderById(orderId);
  }

  /**
   * Process payment confirmation (called by payment webhook/service)
   */
  async confirmPayment(orderId, paymentData) {
    const order = await labOrderRepository.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
      throw new Error("Order is not awaiting payment");
    }

    await labOrderRepository.updatePaymentInfo(orderId, {
      paymentStatus: "paid",
      ...paymentData
    });

    // Send payment confirmation email
    try {
      await this.sendPaymentConfirmationEmail(order, paymentData);
    } catch (emailError) {
      console.error("Failed to send payment confirmation email:", emailError);
    }

    return this.getOrderById(orderId);
  }

  /**
   * Assign personnel to order and create chat room (Lab Admin)
   */
  async assignPersonnelToOrder(orderId, personnelId, labAdminId) {
    const order = await labOrderRepository.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== ORDER_STATUS.PAYMENT_CONFIRMED) {
      throw new Error("Order must be paid before personnel assignment");
    }

    // Verify lab admin access
    await this.verifyFacilityAccess(order.facilityId, labAdminId);

    // Verify personnel belongs to facility and has appropriate role
    const personnel = await labPersonnelRepository.findById(personnelId);
    if (!personnel || personnel.facility.id !== order.facilityId) {
      throw new Error("Personnel not found or not associated with this facility");
    }

    // Verify personnel role matches order type
    const requiredRoles = this.getRequiredPersonnelRoles(order.orderType);
    if (!requiredRoles.includes(personnel.role)) {
      throw new Error(`Personnel role ${personnel.role} cannot handle ${order.orderType} orders`);
    }

    await labOrderRepository.assignPersonnel(orderId, personnelId);

    // CREATE CHAT ROOM FOR ORDER - This is the key integration point
    try {
      const chatRoom = await this.labOrderChatService.createOrderChatRoom(orderId, personnelId);
      console.log(`Chat room created for order ${order.orderNumber}: ${chatRoom.id}`);
    } catch (chatError) {
      console.error("Failed to create chat room:", chatError);
      // Don't fail the assignment if chat creation fails
    }

    // Send assignment notification emails
    try {
      await this.sendAssignmentNotificationEmails(order, personnel);
    } catch (emailError) {
      console.error("Failed to send assignment notification emails:", emailError);
    }

    // Send chat notification about assignment
    await this.labOrderChatService.sendOrderStatusUpdate(
      orderId, 
      ORDER_STATUS.ASSIGNED,
      { personnelName: personnel.fullName }
    );

    return this.getOrderById(orderId);
  }

  /**
   * Schedule appointment/collection (Personnel)
   */
  async scheduleAppointment(orderId, scheduledDateTime, personnelId) {
    const order = await labOrderRepository.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.assignedPersonnelId !== personnelId) {
      throw new Error("Only assigned personnel can schedule appointments");
    }

    if (order.status !== ORDER_STATUS.ASSIGNED) {
      throw new Error("Order must be assigned before scheduling");
    }

    await labOrderRepository.scheduleAppointment(orderId, scheduledDateTime);

    // Send scheduling confirmation to chat
    await this.labOrderChatService.sendOrderStatusUpdate(
      orderId,
      ORDER_STATUS.SCHEDULED,
      { scheduledDateTime: scheduledDateTime.toLocaleString() }
    );

    // Send scheduling confirmation emails
    try {
      await this.sendSchedulingConfirmationEmails(order, scheduledDateTime);
    } catch (emailError) {
      console.error("Failed to send scheduling confirmation emails:", emailError);
    }

    return this.getOrderById(orderId);
  }

  /**
   * Mark collection/radiology as completed (Personnel)
   */
  async completeCollection(orderId, personnelId, completionData = {}) {
    const order = await labOrderRepository.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.assignedPersonnelId !== personnelId) {
      throw new Error("Only assigned personnel can complete collection");
    }

    if (![ORDER_STATUS.ASSIGNED, ORDER_STATUS.SCHEDULED, ORDER_STATUS.IN_PROGRESS].includes(order.status)) {
      throw new Error("Order cannot be completed in current status");
    }

    await labOrderRepository.updateStatus(orderId, ORDER_STATUS.SAMPLE_COLLECTED, completionData);

    // Update chat with collection completion
    await this.labOrderChatService.sendOrderStatusUpdate(
      orderId,
      ORDER_STATUS.SAMPLE_COLLECTED
    );

    // Notify lab technicians through chat
    try {
      await this.notifyLabTechnicians(order);
    } catch (error) {
      console.error("Failed to notify lab technicians:", error);
    }

    return this.getOrderById(orderId);
  }

  /**
   * Start processing tests (Lab Technician)
   */
  async startProcessing(orderId, technicianId) {
    const order = await labOrderRepository.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== ORDER_STATUS.SAMPLE_COLLECTED) {
      throw new Error("Samples must be collected before processing");
    }

    // Verify technician has access to this facility
    const technician = await this.verifyPersonnelAccess(technicianId, order.facilityId, ["lab_technician"]);

    await labOrderRepository.updateStatus(orderId, ORDER_STATUS.PROCESSING, {
      processingStartedAt: new Date()
    });

    // Add technician to chat room
    await this.labOrderChatService.addLabTechnicianToChat(orderId, technicianId);

    // Send processing started notification to chat
    await this.labOrderChatService.sendOrderStatusUpdate(
      orderId,
      ORDER_STATUS.PROCESSING
    );

    return this.getOrderById(orderId);
  }

  /**
   * Upload test results (Lab Technician)
   */
  async uploadResults(orderId, resultsData, technicianId) {
    const order = await labOrderRepository.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== ORDER_STATUS.PROCESSING) {
      throw new Error("Order must be in processing status");
    }

    // Verify technician access
    await this.verifyPersonnelAccess(technicianId, order.facilityId, ["lab_technician"]);

    await labOrderRepository.uploadResults(orderId, resultsData);

    // Update individual order items with results if provided
    if (resultsData.itemResults) {
      for (const itemResult of resultsData.itemResults) {
        await labOrderItemRepository.updateResults(itemResult.itemId, {
          result: itemResult.result,
          normalRange: itemResult.normalRange,
          unit: itemResult.unit,
          isAbnormal: itemResult.isAbnormal
        });
      }
    }

    // Update chat with results ready status
    await this.labOrderChatService.sendOrderStatusUpdate(
      orderId,
      ORDER_STATUS.RESULTS_READY
    );

    // Notify result reviewers
    try {
      await this.notifyResultReviewers(order);
    } catch (emailError) {
      console.error("Failed to notify result reviewers:", emailError);
    }

    return this.getOrderById(orderId);
  }

  /**
   * Review and approve results (Result Reviewer)
   */
  async reviewResults(orderId, reviewData, reviewerId) {
    const order = await labOrderRepository.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== ORDER_STATUS.RESULTS_READY) {
      throw new Error("Results must be ready for review");
    }

    // Verify reviewer access
    const reviewer = await this.verifyPersonnelAccess(reviewerId, order.facilityId, ["result_reviewer"]);

    // Add reviewer to chat room
    await this.labOrderChatService.addResultReviewerToChat(orderId, reviewerId);

    if (reviewData.approved) {
      await labOrderRepository.updateStatus(orderId, ORDER_STATUS.RESULTS_APPROVED, {
        reviewerId,
        reviewerNotes: reviewData.notes,
        reviewCompletedAt: new Date()
      });

      // Send results approval notification to chat
      await this.labOrderChatService.sendOrderStatusUpdate(
        orderId,
        ORDER_STATUS.RESULTS_APPROVED
      );

      // Deliver results to patient
      await this.deliverResultsToPatient(order);
    } else {
      await labOrderRepository.updateStatus(orderId, ORDER_STATUS.REVISION_REQUIRED, {
        reviewerId,
        reviewerNotes: reviewData.notes,
        reviewCompletedAt: new Date()
      });

      // Send revision required message to chat
      await this.labOrderChatService.sendSystemMessage(
        order.chatRoomId,
        `⚠️ Results require revision. Reviewer notes: ${reviewData.notes}`
      );

      // Notify technician of required revisions
      try {
        await this.notifyTechnicianOfRevisions(order, reviewData.notes);
      } catch (emailError) {
        console.error("Failed to notify technician of revisions:", emailError);
      }
    }

    return this.getOrderById(orderId);
  }

  /**
   * Deliver results to patient
   */
  async deliverResultsToPatient(order) {
    // Generate secure result viewing URL
    const resultsUrl = `/orders/${order.id}/results`;

    await labOrderRepository.updateStatus(order.id, ORDER_STATUS.COMPLETED, {
      resultsDeliveredAt: new Date()
    });

    // Send result notification through chat
    await this.labOrderChatService.notifyResultsAvailable(order.id, resultsUrl);

    // Send result notification email
    try {
      await this.sendResultsNotificationEmail(order, resultsUrl);
    } catch (emailError) {
      console.error("Failed to send results notification email:", emailError);
    }

    // Archive chat room after 24 hours
    setTimeout(async () => {
      await this.labOrderChatService.archiveOrderChat(order.id);
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Send preparation instructions to patient
   */
  async sendPreparationInstructions(orderId, instructions) {
    const order = await labOrderRepository.findById(orderId);
    if (!order || !order.chatRoomId) {
      throw new Error("Order or chat room not found");
    }

    await this.labOrderChatService.sendPreparationInstructions(orderId, instructions);
  }

  /**
   * Send quality alert for an order
   */
  async sendQualityAlert(orderId, alert) {
    const order = await labOrderRepository.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    await this.labOrderChatService.sendQualityAlert(order.facilityId, {
      orderNumber: order.orderNumber,
      ...alert
    });
  }

  /**
   * Get order with chat room details
   */
  async getOrderWithChat(orderId, userId) {
    const order = await this.getOrderById(orderId);
    
    if (order.chatRoomId) {
      try {
        const chatRoom = await this.labOrderChatService.getOrderChatRoom(orderId, userId);
        order.chatRoom = chatRoom;
      } catch (error) {
        console.error("Failed to get chat room:", error);
        order.chatRoom = null;
      }
    }

    return order;
  }

  /**
   * Cancel order with chat notification
   */
  async cancelOrder(orderId, reason, requestingUserId) {
    const order = await labOrderRepository.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    // Only patient or facility admin can cancel
    if (order.patientId !== requestingUserId) {
      await this.verifyFacilityAccess(order.facilityId, requestingUserId);
    }

    if ([ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED].includes(order.status)) {
      throw new Error("Cannot cancel order in current status");
    }

    await labOrderRepository.cancelOrder(orderId, reason);

    // Send cancellation notification to chat
    await this.labOrderChatService.sendOrderStatusUpdate(
      orderId,
      ORDER_STATUS.CANCELLED,
      { reason }
    );

    // Handle refunds if payment was made
    if (order.paymentStatus === "paid") {
      await this.processRefund(order);
    }

    return this.getOrderById(orderId);
  }

  // Original helper methods remain the same
  validateOrderData(data) {
    if (!data.facilityId) {
      throw new Error("Facility ID is required");
    }
    if (!data.tests || !Array.isArray(data.tests) || data.tests.length === 0) {
      throw new Error("At least one test must be specified");
    }
    if (data.serviceType === "home_collection" && !data.collectionAddress) {
      throw new Error("Collection address is required for home collection");
    }
  }

  determineOrderType(tests) {
    const hasRadiology = tests.some(test => 
      test.category && test.category.toLowerCase().includes('radiology') ||
      test.name && ['x-ray', 'mri', 'ct', 'ultrasound', 'mammography'].some(type => 
        test.name.toLowerCase().includes(type)
      )
    );
    return hasRadiology ? "radiology" : "lab_test";
  }

  calculateOrderPricing(order, invoiceData) {
    let baseAmount = invoiceData.baseAmount || 0;
    let homeVisitFee = 0;
    let urgentFee = 0;

    if (order.serviceType === "home_collection") {
      homeVisitFee = invoiceData.homeVisitFee || 50;
    }

    if (order.urgentProcessing) {
      urgentFee = invoiceData.urgentFee || (baseAmount * 0.5);
    }

    const totalAmount = baseAmount + homeVisitFee + urgentFee;

    return {
      baseAmount,
      homeVisitFee,
      urgentFee,
      totalAmount,
      currency: invoiceData.currency || "USD"
    };
  }

  getRequiredPersonnelRoles(orderType) {
    if (orderType === "radiology") {
      return ["radiologist"];
    }
    return ["sample_collector", "lab_technician"];
  }

  async verifyFacilityAccess(facilityId, userId) {
    const facility = await labFacilityRepository.findById(facilityId);
    if (!facility) {
      throw new Error("Facility not found");
    }

    if (facility.adminUser && facility.adminUser.id === userId) {
      return true;
    }

    const personnel = await labPersonnelRepository.findByUserId(userId);
    const hasAccess = personnel.some(p => p.facility.id === facilityId && p.status === "active");
    
    if (!hasAccess) {
      throw new Error("Access denied to this facility");
    }

    return true;
  }

  async verifyPersonnelAccess(personnelId, facilityId, requiredRoles = []) {
    const personnel = await labPersonnelRepository.findById(personnelId);
    if (!personnel) {
      throw new Error("Personnel not found");
    }

    if (personnel.facility.id !== facilityId) {
      throw new Error("Personnel not associated with this facility");
    }

    if (personnel.status !== "active") {
      throw new Error("Personnel is not active");
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(personnel.role)) {
      throw new Error(`Personnel role ${personnel.role} not authorized for this operation`);
    }

    return personnel;
  }

  // Other existing methods remain unchanged
  async getOrderById(orderId) {
    const order = await labOrderRepository.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }
    return order;
  }

  async getPatientOrders(patientId, limit = 20, offset = 0) {
    return labOrderRepository.findByPatientId(patientId, limit, offset);
  }

  async getFacilityOrders(facilityId, requestingUserId, limit = 50, offset = 0) {
    await this.verifyFacilityAccess(facilityId, requestingUserId);
    return labOrderRepository.findByFacilityId(facilityId, limit, offset);
  }

  async getPersonnelOrders(personnelId) {
    return labOrderRepository.findByAssignedPersonnel(personnelId);
  }

  async searchOrders(query, facilityId, requestingUserId) {
    if (facilityId) {
      await this.verifyFacilityAccess(facilityId, requestingUserId);
    }
    return labOrderRepository.searchOrders(query, facilityId);
  }

  async getOrderStatistics(facilityId, requestingUserId) {
    if (facilityId) {
      await this.verifyFacilityAccess(facilityId, requestingUserId);
    }
    return labOrderRepository.getOrderStats(facilityId);
  }

  // Email notification methods (placeholders)
  async sendInvoiceEmail(order, pricing) {
    console.log(`Sending invoice email to patient ${order.patient.email} for order ${order.orderNumber}`);
  }

  async sendPaymentConfirmationEmail(order, paymentData) {
    console.log(`Sending payment confirmation to ${order.patient.email} for order ${order.orderNumber}`);
  }

  async sendAssignmentNotificationEmails(order, personnel) {
    console.log(`Notifying ${personnel.email} of assignment to order ${order.orderNumber}`);
  }

  async sendSchedulingConfirmationEmails(order, scheduledDateTime) {
    console.log(`Sending scheduling confirmation for order ${order.orderNumber}`);
  }

  async notifyLabTechnicians(order) {
    console.log(`Notifying lab technicians that samples are ready for order ${order.orderNumber}`);
  }

  async notifyResultReviewers(order) {
    console.log(`Notifying result reviewers that results are ready for order ${order.orderNumber}`);
  }

  async notifyTechnicianOfRevisions(order, notes) {
    console.log(`Notifying technician of required revisions for order ${order.orderNumber}`);
  }

  async sendResultsNotificationEmail(order, resultsUrl) {
    console.log(`Sending results notification to ${order.patient.email} for order ${order.orderNumber}`);
  }

  async processRefund(order) {
    console.log(`Processing refund for order ${order.orderNumber}`);
  }
}

module.exports = new LabOrderService();