// src/websocket/labOrderChatSocket.js
const LabOrderChatService = require("../services/chat");
const labOrderRepository = require("../repositories/lab_order");
const labPersonnelRepository = require("../repositories/lab_personnel");
const labFacilityRepository = require("../repositories/lab_facility");
const { ORDER_STATUS } = require("../utils/constants");
const userRepository = require("../../auth/repositories/userRepository");

class LabOrderChatSocketHandler {
    constructor(io, chatSocketHandler) {
      this.io = io;
      this.chatSocketHandler = chatSocketHandler; // Reference to main chat handler
      this.labOrderChatService = new LabOrderChatService();
    }
  
    initialize() {
      // Extend the main chat socket handler with lab-specific events
      this.io.on("connection", (socket) => {
        if (!socket.userId) return; // Ensure authenticated
  
        this.bindLabOrderEvents(socket);
      });
  
      console.log("Lab Order Chat WebSocket handler initialized");
    }
  
    bindLabOrderEvents(socket) {
      // Join order-specific chat room
      socket.on("join_order_chat", async (data) => {
        await this.handleJoinOrderChat(socket, data);
      });
  
      // Handle order status updates in real-time
      socket.on("update_order_status", async (data) => {
        await this.handleOrderStatusUpdate(socket, data);
      });
  
      // Handle scheduling coordination
      socket.on("propose_schedule", async (data) => {
        await this.handleScheduleProposal(socket, data);
      });
  
      socket.on("confirm_schedule", async (data) => {
        await this.handleScheduleConfirmation(socket, data);
      });
  
      // Handle sample collection updates
      socket.on("sample_collection_started", async (data) => {
        await this.handleCollectionStarted(socket, data);
      });
  
      socket.on("sample_collection_completed", async (data) => {
        await this.handleCollectionCompleted(socket, data);
      });
  
      // Handle test processing updates
      socket.on("test_processing_started", async (data) => {
        await this.handleProcessingStarted(socket, data);
      });
  
      socket.on("test_results_uploaded", async (data) => {
        await this.handleResultsUploaded(socket, data);
      });
  
      // Handle quality alerts
      socket.on("send_quality_alert", async (data) => {
        await this.handleQualityAlert(socket, data);
      });
  
      // Handle patient queries
      socket.on("patient_query", async (data) => {
        await this.handlePatientQuery(socket, data);
      });
  
      // Personnel coordination
      socket.on("request_personnel_assistance", async (data) => {
        await this.handleAssistanceRequest(socket, data);
      });
    }
  
    async handleJoinOrderChat(socket, data) {
      try {
        const { orderId } = data;
  
        // Get order and verify access
        const order = await labOrderRepository.findById(orderId);
        if (!order) {
          return socket.emit("error", { message: "Order not found" });
        }
  
        // Check if chat room exists
        if (!order.chatRoomId) {
          return socket.emit("error", { 
            message: "Chat room not yet created for this order",
            code: "NO_CHAT_ROOM"
          });
        }
  
        // Verify user has access
        const hasAccess = await this.verifyOrderAccess(order, socket.userId);
        if (!hasAccess) {
          return socket.emit("error", { message: "Access denied to order chat" });
        }
  
        // Join the socket room
        socket.join(`order_${orderId}`);
        socket.join(order.chatRoomId);
  
        // Get chat room details
        const chatRoom = await this.labOrderChatService.getOrderChatRoom(orderId, socket.userId);
  
        // Get order progress details
        const orderProgress = this.calculateOrderProgress(order);
  
        // Send complete order chat data
        socket.emit("order_chat_joined", {
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            progress: orderProgress,
            testNames: order.testNames,
            serviceType: order.serviceType,
            urgentProcessing: order.urgentProcessing
          },
          chatRoom,
          participants: await this.getOrderParticipants(order)
        });
  
        // Notify other participants
        socket.to(`order_${orderId}`).emit("participant_joined_order_chat", {
          userId: socket.userId,
          user: socket.user,
          orderId
        });
      } catch (error) {
        console.error("Error joining order chat:", error);
        socket.emit("error", { message: error.message });
      }
    }
  
    async handleOrderStatusUpdate(socket, data) {
      try {
        const { orderId, newStatus, additionalInfo } = data;
  
        // Verify user has permission to update status
        const canUpdate = await this.verifyStatusUpdatePermission(orderId, socket.userId, newStatus);
        if (!canUpdate) {
          return socket.emit("error", { message: "Permission denied to update order status" });
        }
  
        // Send status update to chat
        await this.labOrderChatService.sendOrderStatusUpdate(orderId, newStatus, additionalInfo);
  
        // Broadcast to all participants
        this.io.to(`order_${orderId}`).emit("order_status_changed", {
          orderId,
          newStatus,
          updatedBy: socket.user,
          timestamp: new Date(),
          additionalInfo
        });
  
        // Handle status-specific actions
        await this.handleStatusSpecificActions(orderId, newStatus, socket);
      } catch (error) {
        console.error("Error updating order status:", error);
        socket.emit("error", { message: error.message });
      }
    }
  
    async handleScheduleProposal(socket, data) {
      try {
        const { orderId, proposedDateTime, notes } = data;
  
        // Verify user is assigned personnel
        const isAssignedPersonnel = await this.verifyAssignedPersonnel(orderId, socket.userId);
        if (!isAssignedPersonnel) {
          return socket.emit("error", { message: "Only assigned personnel can propose schedules" });
        }
  
        // Send scheduling message
        const message = await this.labOrderChatService.handleSchedulingMessage(
          orderId,
          socket.userId,
          proposedDateTime
        );
  
        // Notify patient
        const order = await labOrderRepository.findById(orderId);
        const patientSocket = this.chatSocketHandler.getUserSocket(order.patientId);
        
        if (patientSocket) {
          patientSocket.emit("schedule_proposed", {
            orderId,
            proposedDateTime,
            proposedBy: socket.user,
            notes,
            messageId: message.id
          });
        }
  
        socket.emit("schedule_proposal_sent", { success: true, messageId: message.id });
      } catch (error) {
        console.error("Error proposing schedule:", error);
        socket.emit("error", { message: error.message });
      }
    }
  
    async handleScheduleConfirmation(socket, data) {
      try {
        const { orderId, scheduledDateTime, confirmed } = data;
  
        const order = await labOrderRepository.findById(orderId);
        if (!order) {
          return socket.emit("error", { message: "Order not found" });
        }
  
        // Verify user is patient
        if (order.patientId !== socket.userId) {
          return socket.emit("error", { message: "Only patient can confirm schedule" });
        }
  
        if (confirmed) {
          // Update order with scheduled time
          await labOrderRepository.scheduleAppointment(orderId, scheduledDateTime);
  
          // Send confirmation to chat
          await this.labOrderChatService.sendSystemMessage(
            order.chatRoomId,
            `✅ Appointment confirmed for ${new Date(scheduledDateTime).toLocaleString()}`
          );
  
          // Notify all participants
          this.io.to(`order_${orderId}`).emit("schedule_confirmed", {
            orderId,
            scheduledDateTime,
            confirmedBy: socket.user
          });
        } else {
          // Handle reschedule request
          await this.labOrderChatService.sendSystemMessage(
            order.chatRoomId,
            "Patient has requested to reschedule. Please propose a new time."
          );
  
          socket.to(`order_${orderId}`).emit("reschedule_requested", {
            orderId,
            requestedBy: socket.user
          });
        }
      } catch (error) {
        console.error("Error confirming schedule:", error);
        socket.emit("error", { message: error.message });
      }
    }
  
    async handleCollectionStarted(socket, data) {
      try {
        const { orderId, location, estimatedDuration } = data;
  
        // Verify user is assigned sample collector
        const isCollector = await this.verifyRole(orderId, socket.userId, 'sample_collector');
        if (!isCollector) {
          return socket.emit("error", { message: "Only sample collector can start collection" });
        }
  
        // Update order status
        await labOrderRepository.updateStatus(orderId, ORDER_STATUS.IN_PROGRESS);
  
        // Send real-time update
        this.io.to(`order_${orderId}`).emit("collection_started", {
          orderId,
          collector: socket.user,
          location,
          estimatedDuration,
          startTime: new Date()
        });
  
        // Send chat notification
        const order = await labOrderRepository.findById(orderId);
        await this.labOrderChatService.sendSystemMessage(
          order.chatRoomId,
          `🧪 Sample collection has started at ${location}. Estimated duration: ${estimatedDuration} minutes.`
        );
      } catch (error) {
        console.error("Error starting collection:", error);
        socket.emit("error", { message: error.message });
      }
    }
  
    async handleCollectionCompleted(socket, data) {
      try {
        const { orderId, samples, notes, photoUrls } = data;
  
        // Verify user is assigned sample collector
        const isCollector = await this.verifyRole(orderId, socket.userId, 'sample_collector');
        if (!isCollector) {
          return socket.emit("error", { message: "Only sample collector can complete collection" });
        }
  
        // Update order status
        await labOrderRepository.updateStatus(orderId, ORDER_STATUS.SAMPLE_COLLECTED, {
          collectionNotes: notes,
          samplePhotos: photoUrls
        });
  
        // Notify lab technicians
        const order = await labOrderRepository.findById(orderId);
        const technicians = await labPersonnelRepository.findByFacilityAndRole(
          order.facilityId,
          'lab_technician'
        );
  
        // Send notifications to all lab technicians
        technicians.forEach(tech => {
          const techSocket = this.chatSocketHandler.getUserSocket(tech.userId);
          if (techSocket) {
            techSocket.emit("new_samples_ready", {
              orderId,
              orderNumber: order.orderNumber,
              samples,
              priority: order.urgentProcessing ? 'urgent' : 'normal'
            });
          }
        });
  
        // Update chat
        await this.labOrderChatService.sendSystemMessage(
          order.chatRoomId,
          `✅ Sample collection completed successfully. ${samples.length} sample(s) collected.`
        );
  
        // Broadcast to order participants
        this.io.to(`order_${orderId}`).emit("collection_completed", {
          orderId,
          completedBy: socket.user,
          samples,
          timestamp: new Date()
        });
      } catch (error) {
        console.error("Error completing collection:", error);
        socket.emit("error", { message: error.message });
      }
    }
  
    async handleProcessingStarted(socket, data) {
      try {
        const { orderId, estimatedCompletionTime } = data;
  
        // Verify user is lab technician
        const isTechnician = await this.verifyRole(orderId, socket.userId, 'lab_technician');
        if (!isTechnician) {
          return socket.emit("error", { message: "Only lab technician can start processing" });
        }
  
        // Add technician to chat if not already present
        const techPersonnel = await labPersonnelRepository.findByUserId(socket.userId);
        if (techPersonnel && techPersonnel.length > 0) {
          await this.labOrderChatService.addLabTechnicianToChat(orderId, techPersonnel[0].id);
        }
  
        // Update order status
        await labOrderRepository.updateStatus(orderId, ORDER_STATUS.PROCESSING);
  
        // Send real-time updates
        this.io.to(`order_${orderId}`).emit("processing_started", {
          orderId,
          technician: socket.user,
          estimatedCompletionTime,
          startTime: new Date()
        });
  
        // Update chat
        const order = await labOrderRepository.findById(orderId);
        await this.labOrderChatService.sendSystemMessage(
          order.chatRoomId,
          `🔬 Test processing has begun. Estimated completion: ${estimatedCompletionTime}`
        );
      } catch (error) {
        console.error("Error starting processing:", error);
        socket.emit("error", { message: error.message });
      }
    }
  
    async handleResultsUploaded(socket, data) {
      try {
        const { orderId, resultsData, requiresReview } = data;
  
        // Verify user is lab technician
        const isTechnician = await this.verifyRole(orderId, socket.userId, 'lab_technician');
        if (!isTechnician) {
          return socket.emit("error", { message: "Only lab technician can upload results" });
        }
  
        // Update order with results
        await labOrderRepository.uploadResults(orderId, resultsData);
  
        if (requiresReview) {
          // Notify result reviewers
          const order = await labOrderRepository.findById(orderId);
          const reviewers = await labPersonnelRepository.findByFacilityAndRole(
            order.facilityId,
            'result_reviewer'
          );
  
          reviewers.forEach(reviewer => {
            const reviewerSocket = this.chatSocketHandler.getUserSocket(reviewer.userId);
            if (reviewerSocket) {
              reviewerSocket.emit("results_ready_for_review", {
                orderId,
                orderNumber: order.orderNumber,
                priority: order.urgentProcessing ? 'urgent' : 'normal',
                uploadedBy: socket.user
              });
            }
          });
  
          // Update chat
          await this.labOrderChatService.sendSystemMessage(
            order.chatRoomId,
            "📊 Test results have been generated and sent for review."
          );
        }
  
        // Broadcast update
        this.io.to(`order_${orderId}`).emit("results_uploaded", {
          orderId,
          uploadedBy: socket.user,
          requiresReview,
          timestamp: new Date()
        });
      } catch (error) {
        console.error("Error uploading results:", error);
        socket.emit("error", { message: error.message });
      }
    }
  
    async handleQualityAlert(socket, data) {
      try {
        const { orderId, issue, severity, actionRequired } = data;
  
        // Verify user is lab personnel
        const order = await labOrderRepository.findById(orderId);
        const isLabPersonnel = await this.verifyLabPersonnel(order.facilityId, socket.userId);
        
        if (!isLabPersonnel) {
          return socket.emit("error", { message: "Only lab personnel can send quality alerts" });
        }
  
        // Send quality alert
        await this.labOrderChatService.sendQualityAlert(order.facilityId, {
          orderNumber: order.orderNumber,
          issue,
          severity,
          actionRequired
        });
  
        // Notify lab admin
        const facility = await labFacilityRepository.findById(order.facilityId);
        const adminSocket = this.chatSocketHandler.getUserSocket(facility.adminUser.id);
        
        if (adminSocket) {
          adminSocket.emit("quality_alert_received", {
            orderId,
            orderNumber: order.orderNumber,
            issue,
            severity,
            actionRequired,
            reportedBy: socket.user,
            timestamp: new Date()
          });
        }
  
        socket.emit("quality_alert_sent", { success: true });
      } catch (error) {
        console.error("Error sending quality alert:", error);
        socket.emit("error", { message: error.message });
      }
    }
  
    async handlePatientQuery(socket, data) {
      try {
        const { orderId, query, category } = data;
  
        // Verify user is patient
        const order = await labOrderRepository.findById(orderId);
        if (order.patientId !== socket.userId) {
          return socket.emit("error", { message: "Only patient can send queries" });
        }
  
        // Route query to appropriate personnel based on category
        let targetPersonnel = null;
        
        switch(category) {
          case 'scheduling':
            targetPersonnel = order.assignedPersonnel;
            break;
          case 'results':
            targetPersonnel = order.reviewer;
            break;
          case 'billing':
            // Route to lab admin
            // const facility = await labFacilityRepository.findById(order.facilityId);
            targetPersonnel = { userId: await labFacilityRepository.findById(order.facilityId).adminUser.id };
            break;
          default:
            targetPersonnel = order.assignedPersonnel;
        }
  
        if (targetPersonnel && targetPersonnel.userId) {
          const targetSocket = this.chatSocketHandler.getUserSocket(targetPersonnel.userId);
          if (targetSocket) {
            targetSocket.emit("patient_query_received", {
              orderId,
              orderNumber: order.orderNumber,
              patient: socket.user,
              query,
              category,
              timestamp: new Date()
            });
          }
        }
  
        // Send query to chat room
        const ChatMessageService = require("../../chat/services/chatMessageService");
        const messageService = new ChatMessageService();
        await messageService.sendMessage(
          socket.userId,
          order.chatRoomId,
          query,
          {
            type: 'query',
            metadata: { category }
          }
        );
  
        socket.emit("query_sent", { success: true });
      } catch (error) {
        console.error("Error handling patient query:", error);
        socket.emit("error", { message: error.message });
      }
    }
  
    async handleAssistanceRequest(socket, data) {
      try {
        const { orderId, reason, urgency } = data;
  
        // Verify user is lab personnel
        const order = await labOrderRepository.findById(orderId);
        const isLabPersonnel = await this.verifyLabPersonnel(order.facilityId, socket.userId);
        
        if (!isLabPersonnel) {
          return socket.emit("error", { message: "Only lab personnel can request assistance" });
        }
  
        // Notify lab admin and managers
        const facility = await labFacilityRepository.findById(order.facilityId);
        const managers = await labPersonnelRepository.findByFacilityAndRole(
          order.facilityId,
          'lab_manager'
        );
  
        // Send to lab admin
        const adminSocket = this.chatSocketHandler.getUserSocket(facility.adminUser.id);
        if (adminSocket) {
          adminSocket.emit("assistance_requested", {
            orderId,
            orderNumber: order.orderNumber,
            requestedBy: socket.user,
            reason,
            urgency,
            timestamp: new Date()
          });
        }
  
        // Send to managers
        managers.forEach(manager => {
          const managerSocket = this.chatSocketHandler.getUserSocket(manager.userId);
          if (managerSocket) {
            managerSocket.emit("assistance_requested", {
              orderId,
              orderNumber: order.orderNumber,
              requestedBy: socket.user,
              reason,
              urgency,
              timestamp: new Date()
            });
          }
        });
  
        // Log in chat
        await this.labOrderChatService.sendSystemMessage(
          order.chatRoomId,
          `🆘 Assistance requested: ${reason} (Urgency: ${urgency})`
        );
  
        socket.emit("assistance_request_sent", { success: true });
      } catch (error) {
        console.error("Error requesting assistance:", error);
        socket.emit("error", { message: error.message });
      }
    }
  
    // Helper methods
    async verifyOrderAccess(order, userId) {
      // Patient always has access
      if (order.patientId === userId) return true;
  
      // Check if user is assigned personnel
      if (order.assignedPersonnel && order.assignedPersonnel.userId === userId) return true;
      if (order.reviewer && order.reviewer.userId === userId) return true;
  
      // Check if user is lab personnel in the facility
      return await this.verifyLabPersonnel(order.facilityId, userId);
    }
  
    async verifyLabPersonnel(facilityId, userId) {
      const personnel = await labPersonnelRepository.findByUserId(userId);
      return personnel.some(p => p.facility.id === facilityId && p.status === 'active');
    }
  
    async verifyAssignedPersonnel(orderId, userId) {
      const order = await labOrderRepository.findById(orderId);
      return order.assignedPersonnel && order.assignedPersonnel.userId === userId;
    }
  
    async verifyRole(orderId, userId, requiredRole) {
      const order = await labOrderRepository.findById(orderId);
      const personnel = await labPersonnelRepository.findByUserId(userId);
      
      return personnel.some(p => 
        p.facility.id === order.facilityId && 
        p.role === requiredRole && 
        p.status === 'active'
      );
    }
  
    async verifyStatusUpdatePermission(orderId, userId, newStatus) {
      const order = await labOrderRepository.findById(orderId);
      
      // Define who can update to each status
      const statusPermissions = {
        [ORDER_STATUS.PENDING_PAYMENT]: ['lab_admin'],
        [ORDER_STATUS.PAYMENT_CONFIRMED]: ['system'], // Automatic via payment webhook
        [ORDER_STATUS.ASSIGNED]: ['lab_admin'],
        [ORDER_STATUS.SCHEDULED]: ['sample_collector', 'radiologist'],
        [ORDER_STATUS.IN_PROGRESS]: ['sample_collector', 'radiologist'],
        [ORDER_STATUS.SAMPLE_COLLECTED]: ['sample_collector'],
        [ORDER_STATUS.PROCESSING]: ['lab_technician'],
        [ORDER_STATUS.RESULTS_READY]: ['lab_technician'],
        [ORDER_STATUS.UNDER_REVIEW]: ['result_reviewer'],
        [ORDER_STATUS.RESULTS_APPROVED]: ['result_reviewer'],
        [ORDER_STATUS.COMPLETED]: ['system'],
        [ORDER_STATUS.CANCELLED]: ['lab_admin', 'patient']
      };
  
      const allowedRoles = statusPermissions[newStatus] || [];
      
      // Check if user is patient (for cancellation)
      if (allowedRoles.includes('patient') && order.patientId === userId) {
        return true;
      }
  
      // Check if user has required role
      const personnel = await labPersonnelRepository.findByUserId(userId);
      return personnel.some(p => 
        p.facility.id === order.facilityId && 
        allowedRoles.includes(p.role)
      );
    }
  
    calculateOrderProgress(order) {
      const statusProgress = {
        [ORDER_STATUS.CREATED]: 10,
        [ORDER_STATUS.PENDING_PAYMENT]: 20,
        [ORDER_STATUS.PAYMENT_CONFIRMED]: 30,
        [ORDER_STATUS.ASSIGNED]: 40,
        [ORDER_STATUS.SCHEDULED]: 45,
        [ORDER_STATUS.IN_PROGRESS]: 50,
        [ORDER_STATUS.SAMPLE_COLLECTED]: 60,
        [ORDER_STATUS.PROCESSING]: 70,
        [ORDER_STATUS.RESULTS_READY]: 80,
        [ORDER_STATUS.UNDER_REVIEW]: 85,
        [ORDER_STATUS.RESULTS_APPROVED]: 95,
        [ORDER_STATUS.COMPLETED]: 100,
        [ORDER_STATUS.CANCELLED]: 0
      };
  
      return {
        percentage: statusProgress[order.status] || 0,
        currentStep: order.status,
        estimatedTimeRemaining: this.estimateTimeRemaining(order)
      };
    }
  
    estimateTimeRemaining(order) {
      // Calculate based on order type and current status
      const estimations = {
        'lab_test': {
          [ORDER_STATUS.PROCESSING]: '2-4 hours',
          [ORDER_STATUS.RESULTS_READY]: '30 minutes',
          [ORDER_STATUS.UNDER_REVIEW]: '15 minutes'
        },
        'radiology': {
          [ORDER_STATUS.PROCESSING]: '1-2 hours',
          [ORDER_STATUS.RESULTS_READY]: '20 minutes',
          [ORDER_STATUS.UNDER_REVIEW]: '10 minutes'
        }
      };
  
      return estimations[order.orderType]?.[order.status] || 'Calculating...';
    }
  
    async getOrderParticipants(order) {
      const participants = [];
  
      // Add patient
      const patient = await userRepository.findById(order.patientId);
      if (patient) {
        participants.push({
          user: patient,
          role: 'patient',
          isOnline: this.chatSocketHandler.onlineUsers.has(patient.id)
        });
      }
  
      // Add assigned personnel
      if (order.assignedPersonnel) {
        const personnel = await userRepository.findById(order.assignedPersonnel.userId);
        if (personnel) {
          participants.push({
            user: personnel,
            role: order.assignedPersonnel.role,
            isOnline: this.chatSocketHandler.onlineUsers.has(personnel.id)
          });
        }
      }
  
      // Add reviewer if assigned
      if (order.reviewer) {
        const reviewer = await userRepository.findById(order.reviewer.userId);
        if (reviewer) {
          participants.push({
            user: reviewer,
            role: 'result_reviewer',
            isOnline: this.chatSocketHandler.onlineUsers.has(reviewer.id)
          });
        }
      }
  
      return participants;
    }
  
    async handleStatusSpecificActions(orderId, newStatus, socket) {
      const order = await labOrderRepository.findById(orderId);
      const facility = await labFacilityRepository.findById(order.facilityId);
      const adminSocket = this.chatSocketHandler.getUserSocket(facility.adminUser.id);
      const patientSocket = this.chatSocketHandler.getUserSocket(order.patientId);

      switch(newStatus) {
        case ORDER_STATUS.PAYMENT_CONFIRMED:
          // Notify lab admin to assign personnel
      
          if (adminSocket) {
            adminSocket.emit("new_paid_order", {
              orderId,
              orderNumber: order.orderNumber,
              orderType: order.orderType,
              urgentProcessing: order.urgentProcessing
            });
          }
          break;
  
        case ORDER_STATUS.ASSIGNED:
          // Create chat room if not exists
          if (!order.chatRoomId && order.assignedPersonnel) {
            await this.labOrderChatService.createOrderChatRoom(orderId, order.assignedPersonnel.id);
          }
          break;
  
        case ORDER_STATUS.RESULTS_APPROVED:
          // Notify patient that results are ready
          if (patientSocket) {
            patientSocket.emit("results_ready", {
              orderId,
              orderNumber: order.orderNumber,
              viewUrl: `/orders/${orderId}/results`
            });
          }
  
          // Send result notification to chat
          await this.labOrderChatService.notifyResultsAvailable(
            orderId,
            `/orders/${orderId}/results`
          );
          break;
  
        case ORDER_STATUS.COMPLETED:
          // Archive chat room after 24 hours
          setTimeout(async () => {
            await this.labOrderChatService.archiveOrderChat(orderId);
          }, 24 * 60 * 60 * 1000);
          break;
      }
    }
  
    // Broadcast order updates to facility dashboard
    broadcastFacilityUpdate(facilityId, update) {
      this.io.to(`facility_${facilityId}`).emit("facility_order_update", update);
    }
  
    // Get real-time order statistics for facility dashboard
    async getFacilityOrderStats(facilityId) {
      const stats = await labOrderRepository.getOrderStats(facilityId);
      
      // Add real-time active orders count
      const activeOrders = await labOrderRepository.findByStatus(ORDER_STATUS.IN_PROGRESS, facilityId);
      stats.activeOrdersCount = activeOrders.length;
  
      return stats;
    }
  }
  
  module.exports = LabOrderChatSocketHandler;