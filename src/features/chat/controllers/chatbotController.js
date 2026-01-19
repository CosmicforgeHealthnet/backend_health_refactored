// src/controllers/chatbotController.js
const ChatbotService = require('../services/chatbotService');
const { USER_ROLES } = require('../../../shared/utils/constants');
const { validationResult } = require('express-validator');

class ChatbotController {
  constructor() {
    this.chatbotService = new ChatbotService();
  }

  /**
   * Handle general chat (for patients)
   * POST /chatbot/chat
   */
  async chat(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payload',
          details: errors.array()
        });
      }

      const userId = req.user.sub;
      const userRole = req.user.role;
      const { message, sessionId } = req.body;
      const files = req.files || [];

      // Determine user type and session type
      const userType = userRole === USER_ROLES.DOCTOR ? 'doctor' : 'patient';
      const sessionType = 'general';

      // Get or create session
      let session;
      if (sessionId) {
        session = await this.chatbotService.getSessionWithMessages(sessionId, userId);
        if (!session) {
          return res.status(404).json({
            success: false,
            error: 'Session not found'
          });
        }
      } else {
        // Create a new session for each new conversation
        session = await this.chatbotService.createSession(userId, userType, sessionType);
      }

      // Validate message
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Message is required and cannot be empty'
        });
      }

      // Process the chat message (use the created session id)
      const result = await this.chatbotService.processChat(
        userId,
        userType,
        sessionType,
        message.trim(),
        session.id,
        files
      );

      // Send response
      res.json({
        success: true,
        sessionId: result.sessionId,
        answer: result.answer,
        metadata: result.metadata
      });

    } catch (error) {
      console.error('Chat error:', error);

      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({
          success: false,
          error: 'Missing or invalid Authorization header'
        });
      } else if (error.message.includes('Invalid request')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payload: ' + error.message
        });
      } else if (error.message.includes('unavailable')) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable'
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Handle doctor chat (for healthcare professionals)
   * POST /chatbot/doctorchat
   */
  async doctorChat(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payload',
          details: errors.array()
        });
      }

      const userId = req.user.sub;
      const userRole = req.user.role;
      const { message, sessionId } = req.body;
      const files = req.files || [];

      // Verify user is a doctor
      if (userRole !== USER_ROLES.DOCTOR) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Doctor role required.'
        });
      }

      const userType = 'doctor';
      const sessionType = 'doctor';

      // Get or create session
      let session;
      if (sessionId) {
        session = await this.chatbotService.getSessionWithMessages(sessionId, userId);
        if (!session) {
          return res.status(404).json({
            success: false,
            error: 'Session not found'
          });
        }
      } else {
        // Create a new session for each new conversation
        session = await this.chatbotService.createSession(userId, userType, sessionType);
      }

      // Validate message
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Message is required and cannot be empty'
        });
      }

      // Process the chat message (use the created session id)
      const result = await this.chatbotService.processChat(
        userId,
        userType,
        sessionType,
        message.trim(),
        session.id,
        files
      );

      // Send response
      res.json({
        success: true,
        sessionId: result.sessionId,
        answer: result.answer,
        metadata: result.metadata
      });

    } catch (error) {
      console.error('Doctor chat error:', error);

      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({
          success: false,
          error: 'Missing or invalid Authorization header'
        });
      } else if (error.message.includes('Invalid request')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payload: ' + error.message
        });
      } else if (error.message.includes('unavailable')) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable'
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get user's chatbot sessions
   * GET /chatbot/sessions
   */
  async getSessions(req, res) {
    try {
      const userId = req.user.sub;
      const { sessionType, limit = 20, offset = 0 } = req.query;

      const sessions = await this.chatbotService.getUserSessions(
        userId,
        sessionType,
        parseInt(limit),
        parseInt(offset)
      );

      // Map to only id and title per API contract
      const minimal = sessions.map(s => ({ id: s.id, title: s.title || null }));

      res.json({
        success: true,
        data: minimal,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: minimal.length
        }
      });

    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sessions'
      });
    }
  }

  /**
   * Get specific session with messages
   * GET /chatbot/sessions/:sessionId
   */
  async getSession(req, res) {
    try {
      const userId = req.user.sub;
      const { sessionId } = req.params;

      const session = await this.chatbotService.getSessionWithMessages(sessionId, userId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      // Format messages for frontend
      const formattedMessages = session.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        messageType: msg.messageType,
        createdAt: msg.createdAt,
        metadata: msg.metadata
      }));

      res.json({
        success: true,
        data: {
          id: session.id,
          title: session.title,
          sessionType: session.sessionType,
          messageCount: session.messageCount,
          isActive: session.isActive,
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
          messages: formattedMessages
        }
      });

    } catch (error) {
      console.error('Get session error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch session'
      });
    }
  }
}

module.exports = ChatbotController;
