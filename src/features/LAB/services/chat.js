// src/services/chat/labOrderChatService.js
const ChatRoomService = require("../../chat/services/chatRoomService");
const ChatMessageService = require("../../chat/services/chatMessageService");
const labOrderRepository = require("../repositories/lab_order");
const labPersonnelRepository = require("../repositories/lab_personnel");
const labFacilityRepository = require("../repositories/lab_facility");
const userRepository = require("../../auth/repositories/userRepository");
const { ORDER_STATUS } = require("../utils/constants");

class LabOrderChatService {
  constructor() {
    this.chatRoomService = new ChatRoomService();
    this.messageService = new ChatMessageService();
  }

  /**
   * Create order-specific chat room when personnel is assigned (Step 10)
   */
  async createOrderChatRoom(orderId, assignedPersonnelId) {
    const order = await labOrderRepository.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const personnel = await labPersonnelRepository.findById(assignedPersonnelId);
    if (!personnel) {
      throw new Error("Personnel not found");
    }

    // Create chat room with order context
    const roomData = {
      name: `Order #${order.orderNumber} - ${order.patient.fullName}`,
      description: `Chat room for lab order ${order.orderNumber}`,
      type: 'order_chat',
      isPrivate: true,
      maxParticipants: 10, // Allow for multiple personnel to join
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        facilityId: order.facilityId,
        orderType: order.orderType,
        serviceType: order.serviceType,
        testNames: order.testNames,
        currentStatus: order.status
      }
    };

    // Create room with patient as creator
    const room = await this.chatRoomService.createRoom(order.patientId, roomData);

    // Add assigned personnel to room
    await this.chatRoomService.addParticipant(
      room.id, 
      personnel.userId, 
      'member',
      order.patientId
    );

    // Link chat room to order
    await labOrderRepository.update(order.id, { chatRoomId: room.id });

    // Send initial system message with order details
    await this.sendSystemMessage(room.id, this.generateInitialMessage(order, personnel));

    return room;
  }

  /**
   * Add lab technician to chat when processing begins (Step 12)
   */
  async addLabTechnicianToChat(orderId, technicianId) {
    const order = await labOrderRepository.findById(orderId);
    if (!order || !order.chatRoomId) {
      throw new Error("Order or chat room not found");
    }

    const technician = await labPersonnelRepository.findById(technicianId);
    if (!technician) {
      throw new Error("Technician not found");
    }

    // Add technician to existing chat room
    await this.chatRoomService.addParticipant(
      order.chatRoomId,
      technician.userId,
      'member'
    );

    // Send system message about technician joining
    await this.sendSystemMessage(
      order.chatRoomId,
      `Lab Technician ${technician.fullName} has joined to process your tests.`
    );

    // Update room metadata with processing status
    await this.updateRoomStatus(order.chatRoomId, ORDER_STATUS.PROCESSING);

    return true;
  }

  /**
   * Add result reviewer to chat (Step 13)
   */
  async addResultReviewerToChat(orderId, reviewerId) {
    const order = await labOrderRepository.findById(orderId);
    if (!order || !order.chatRoomId) {
      throw new Error("Order or chat room not found");
    }

    const reviewer = await labPersonnelRepository.findById(reviewerId);
    if (!reviewer) {
      throw new Error("Reviewer not found");
    }

    // Add reviewer to chat room
    await this.chatRoomService.addParticipant(
      order.chatRoomId,
      reviewer.userId,
      'member'
    );

    // Send system message
    await this.sendSystemMessage(
      order.chatRoomId,
      `Result Reviewer ${reviewer.fullName} has joined to review your test results.`
    );

    // Update room metadata
    await this.updateRoomStatus(order.chatRoomId, ORDER_STATUS.UNDER_REVIEW);

    return true;
  }

  /**
   * Send automated status updates to chat room
   */
  async sendOrderStatusUpdate(orderId, newStatus, additionalInfo = {}) {
    const order = await labOrderRepository.findById(orderId);
    if (!order || !order.chatRoomId) {
      return; // No chat room created yet
    }

    const statusMessages = {
      [ORDER_STATUS.PENDING_PAYMENT]: "Invoice has been generated. Please complete payment to proceed.",
      [ORDER_STATUS.PAYMENT_CONFIRMED]: "Payment confirmed! Your order is being processed.",
      [ORDER_STATUS.ASSIGNED]: `${additionalInfo.personnelName || 'Personnel'} has been assigned to your order.`,
      [ORDER_STATUS.SCHEDULED]: `Appointment scheduled for ${additionalInfo.scheduledDateTime || 'the selected time'}.`,
      [ORDER_STATUS.IN_PROGRESS]: "Sample collection/radiology service is in progress.",
      [ORDER_STATUS.SAMPLE_COLLECTED]: "Sample collection completed successfully.",
      [ORDER_STATUS.PROCESSING]: "Your tests are being processed in the laboratory.",
      [ORDER_STATUS.RESULTS_READY]: "Test results are ready and under review.",
      [ORDER_STATUS.RESULTS_APPROVED]: "Your test results have been approved and are ready for viewing.",
      [ORDER_STATUS.COMPLETED]: "Your order has been completed. Results are available in your dashboard.",
      [ORDER_STATUS.CANCELLED]: `Order has been cancelled. Reason: ${additionalInfo.reason || 'Not specified'}`
    };

    const message = statusMessages[newStatus];
    if (message) {
      await this.sendSystemMessage(order.chatRoomId, message);
      await this.updateRoomStatus(order.chatRoomId, newStatus);
    }
  }

  /**
   * Handle scheduling coordination through chat
   */
  async handleSchedulingMessage(orderId, senderId, proposedDateTime) {
    const order = await labOrderRepository.findById(orderId);
    if (!order || !order.chatRoomId) {
      throw new Error("Order or chat room not found");
    }

    // Create scheduling message with action buttons (metadata)
    const message = await this.messageService.sendMessage(
      senderId,
      order.chatRoomId,
      `Proposed appointment time: ${proposedDateTime}`,
      {
        type: 'scheduling',
        metadata: {
          proposedDateTime,
          requiresConfirmation: true,
          actions: ['confirm', 'reschedule', 'cancel']
        }
      }
    );

    return message;
  }

  /**
   * Send test preparation instructions
   */
  async sendPreparationInstructions(orderId, instructions) {
    const order = await labOrderRepository.findById(orderId);
    if (!order || !order.chatRoomId) {
      throw new Error("Order or chat room not found");
    }

    const message = `
📋 **Test Preparation Instructions**

${instructions}

Please follow these instructions carefully for accurate test results.
If you have any questions, feel free to ask here.
    `;

    await this.sendSystemMessage(order.chatRoomId, message);
  }

  /**
   * Handle result delivery notifications
   */
  async notifyResultsAvailable(orderId, resultsUrl) {
    const order = await labOrderRepository.findById(orderId);
    if (!order || !order.chatRoomId) {
      throw new Error("Order or chat room not found");
    }

    const message = `
✅ **Your Test Results Are Ready!**

Your test results for Order #${order.orderNumber} are now available.

[View Results](${resultsUrl})

If you have any questions about your results, our Result Reviewer is available to help.
    `;

    await this.sendSystemMessage(order.chatRoomId, message);
    
    // Update room status to completed
    await this.updateRoomStatus(order.chatRoomId, ORDER_STATUS.COMPLETED);
  }

  /**
   * Get chat room for an order
   */
  async getOrderChatRoom(orderId, userId) {
    const order = await labOrderRepository.findById(orderId);
    if (!order || !order.chatRoomId) {
      return null;
    }

    // Verify user has access (patient or assigned personnel)
    const hasAccess = await this.verifyUserAccess(order, userId);
    if (!hasAccess) {
      throw new Error("Access denied to order chat");
    }

    return await this.chatRoomService.getRoomWithDetails(order.chatRoomId);
  }

  /**
   * Create facility-wide coordination chat rooms
   */
  async createFacilityCoordinationRoom(facilityId, roomType) {
    const roomTypes = {
      'order_processing': {
        name: 'Order Processing Team',
        description: 'Coordination for order processing and assignments'
      },
      'quality_alerts': {
        name: 'Quality Alerts',
        description: 'Quality issues and urgent notifications'
      },
      'lab_operations': {
        name: 'Lab Operations',
        description: 'Daily operations and workflow coordination'
      }
    };

    const config = roomTypes[roomType];
    if (!config) {
      throw new Error("Invalid room type");
    }

    const roomData = {
      ...config,
      type: 'facility_internal',
      isPrivate: true,
      metadata: {
        facilityId,
        roomType,
        isInternal: true
      }
    };

    // Create room with facility admin as creator
    const facility = await labFacilityRepository.findById(facilityId);
    if (!facility || !facility.adminUser) {
      throw new Error("Facility or admin not found");
    }

    return await this.chatRoomService.createRoom(facility.adminUser.id, roomData);
  }

  /**
   * Send quality alert to internal team
   */
  async sendQualityAlert(facilityId, alert) {
    // Find or create quality alerts room
    const rooms = await this.chatRoomService.getUserRooms(facilityId);
    const qualityRoom = rooms.find(r => 
      r.metadata?.roomType === 'quality_alerts' && 
      r.metadata?.facilityId === facilityId
    );

    if (!qualityRoom) {
      throw new Error("Quality alerts room not found");
    }

    const message = `
🚨      **QUALITY ALERT**

        Order: ${alert.orderNumber}
        Issue: ${alert.issue}
        Severity: ${alert.severity}
        Action Required: ${alert.actionRequired}

        Please address this immediately.
    `;

    await this.sendSystemMessage(qualityRoom.id, message);
  }

  // Helper methods
  async sendSystemMessage(roomId, content) {
    // System messages are sent with a special system user ID
    const systemUserId = 'system'; // You might want to create an actual system user
    
    return await this.messageService.sendMessage(
      systemUserId,
      roomId,
      content,
      { type: 'system' }
    );
  }

  async updateRoomStatus(roomId, status) {
    const room = await this.chatRoomService.getRoomWithDetails(roomId);
    if (!room) return;

    const updatedMetadata = {
      ...room.metadata,
      currentStatus: status,
      lastStatusUpdate: new Date()
    };

    await this.chatRoomService.updateRoom(roomId, room.createdBy.id, {
      metadata: updatedMetadata
    });
  }

  generateInitialMessage(order, personnel) {
    const roleNames = {
      'sample_collector': 'Sample Collector',
      'radiologist': 'Radiologist',
      'lab_technician': 'Lab Technician',
      'result_reviewer': 'Result Reviewer'
    };

    return `
        Welcome to your order chat room!

        **Order Details:**
        - Order Number: ${order.orderNumber}
        - Tests: ${order.testNames.join(', ')}
        - Service Type: ${order.serviceType === 'home_collection' ? 'Home Collection' : 'Lab Visit'}
        ${order.urgentProcessing ? '- ⚡ Urgent Processing Requested' : ''}

        **Assigned Personnel:**
        ${personnel.fullName} (${roleNames[personnel.role] || personnel.role})

        Feel free to ask any questions or coordinate scheduling here.
            `;
  }

  async verifyUserAccess(order, userId) {
    // Patient always has access
    if (order.patientId === userId) return true;

    // Check if user is assigned personnel
    if (order.assignedPersonnel && order.assignedPersonnel.userId === userId) return true;

    // Check if user is lab admin of the facility
    const facility = await labFacilityRepository.findById(order.facilityId);
    if (facility && facility.adminUser && facility.adminUser.id === userId) return true;

    // Check if user is any personnel in the facility
    const personnel = await labPersonnelRepository.findByUserId(userId);
    return personnel.some(p => p.facility.id === order.facilityId);
  }

  /**
   * Archive chat room when order is completed
   */
  async archiveOrderChat(orderId) {
    const order = await labOrderRepository.findById(orderId);
    if (!order || !order.chatRoomId) return;

    await this.chatRoomService.updateRoom(order.chatRoomId, 'system', {
      isArchived: true,
      archivedAt: new Date(),
      metadata: {
        ...order.metadata,
        archived: true,
        finalStatus: order.status
      }
    });
  }
}

module.exports =  LabOrderChatService;