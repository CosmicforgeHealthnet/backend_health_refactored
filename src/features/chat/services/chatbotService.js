// src/services/chatbotService.js
const AppDataSource = require('../../../config/database');
const axios = require('axios');
const FormData = require('form-data');
const config = require('../../../config');

class ChatbotService {
  constructor() {
    this.sessionRepo = AppDataSource.getRepository('ChatbotSession');
    this.messageRepo = AppDataSource.getRepository('ChatbotMessage');
    this.flaskBaseUrl = config.flaskBackendUrl || 'http://localhost:8000';
  }

  /**f
   * Create a new chatbot session
   */
  async createSession(userId, userType, sessionType) {
    try {
      const session = this.sessionRepo.create({
        userId,
        userType,
        sessionType,
        isActive: true,
        messageCount: 0,
        lastActivityAt: new Date()
      });

      return await this.sessionRepo.save(session);
    } catch (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  /**
   * Get user's sessions
   */
  async getUserSessions(userId, sessionType = null) {
    try {
      const whereClause = { userId, isActive: true };
      if (sessionType) {
        whereClause.sessionType = sessionType;
      }

      return await this.sessionRepo.find({
        where: whereClause,
        order: { lastActivityAt: 'DESC' },
        relations: ['messages']
      });
    } catch (error) {
      throw new Error(`Failed to get sessions: ${error.message}`);
    }
  }

  /**
   * Get session by ID with messages
   */
  async getSession(sessionId, userId) {
    try {
      const session = await this.sessionRepo.findOne({
        where: { id: sessionId, userId },
        relations: ['messages'],
        order: { messages: { createdAt: 'ASC' } }
      });

      if (!session) {
        throw new Error('Session not found');
      }

      return session;
    } catch (error) {
      throw new Error(`Failed to get session: ${error.message}`);
    }
  }

  /**
   * Get or create active session
   */
  async getOrCreateActiveSession(userId, userType, sessionType) {
    try {
      // Try to find an active session
      let session = await this.sessionRepo.findOne({
        where: {
          userId,
          sessionType,
          isActive: true
        },
        order: { lastActivityAt: 'DESC' }
      });

      // If no active session, create one
      if (!session) {
        session = await this.createSession(userId, userType, sessionType);
      }

      return session;
    } catch (error) {
      throw new Error(`Failed to get or create session: ${error.message}`);
    }
  }

  /**
   * Save user message to database
   */
  async saveMessage(sessionId, userId, content, messageType, role, metadata = null) {
    try {
      const message = this.messageRepo.create({
        sessionId,
        userId,
        content,
        messageType,
        role,
        metadata
      });

      const savedMessage = await this.messageRepo.save(message);

      // Update session message count and last activity
      await this.sessionRepo.update(sessionId, {
        messageCount: () => '"messageCount" + 1',
        lastActivityAt: new Date()
      });

      return savedMessage;
    } catch (error) {
      throw new Error(`Failed to save message: ${error.message}`);
    }
  }

  /**
   * Get session history for Flask API
   */
  async getSessionHistory(sessionId) {
    try {
      const messages = await this.messageRepo.find({
        where: { sessionId },
        order: { createdAt: 'ASC' }
      });

      // Format for Flask API (MCPEnvelope format)
      return messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    } catch (error) {
      throw new Error(`Failed to get session history: ${error.message}`);
    }
  }

  /**
   * Call Flask chatbot API
   */
  async callFlaskChatbot(endpoint, history, userContext = {}, message = null, assistantType = null, files = []) {
    try {
      const url = `${this.flaskBaseUrl}${endpoint}`;
      const startTime = Date.now();

      // If multimodal endpoint, send multipart/form-data
      let response;
      if (endpoint === '/v1/multimodal') {
        const form = new FormData();
        // history should be a stringified JSON array per swagger
        form.append('history', JSON.stringify(history || []));
        if (message) form.append('message', message);
        if (assistantType) form.append('assistant_type', assistantType);

        // Attach files (multer provides buffer + originalname + mimetype)
        if (Array.isArray(files) && files.length > 0) {
          files.forEach((f, idx) => {
            // f should be { buffer, originalname, mimetype }
            if (f && f.buffer) {
              form.append('files', f.buffer, {
                filename: f.originalname || `file_${idx}`,
                contentType: f.mimetype || 'application/octet-stream'
              });
            }
          });
        }

        response = await axios.post(url, form, {
          headers: {
            ...form.getHeaders(),
            'User-Context': JSON.stringify(userContext)
          },
          maxBodyLength: Infinity,
          timeout: 30000
        });
      } else {
        // fallback to existing JSON behaviour
        response = await axios.post(url, {
          history
        }, {
          headers: {
            'Content-Type': 'application/json',
            'User-Context': JSON.stringify(userContext)
          },
          timeout: 30000 // 30 second timeout
        });
      }

      const processingTime = Date.now() - startTime;

      return {
        answer: response.data.answer,
        metadata: {
          processingTime,
          flaskEndpoint: endpoint,
          userContext,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      if (error.response) {
        throw new Error(`Flask API error: ${error.response.data.error || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Flask API is not responding');
      } else {
        throw new Error(`Request error: ${error.message}`);
      }
    }
  }

  /**
   * Process chat message - complete flow
   */
  async processChat(userId, userType, sessionType, message, sessionId = null, files = []) {
    try {
      // Get or create session
      let session;
      if (sessionId) {
        session = await this.getSession(sessionId, userId);
      } else {
        session = await this.getOrCreateActiveSession(userId, userType, sessionType);
      }

      // Save user message
      await this.saveMessage(session.id, userId, message, 'user', 'user');

      // Get conversation history
      const history = await this.getSessionHistory(session.id);

      // Use multimodal endpoint and pass assistant_type based on sessionType
      const endpoint = '/v1/multimodal';
      const assistantType = sessionType === 'doctor' ? 'clinician' : 'patient';

      // Call Flask API (multimodal accepts multipart/form-data)
      const { answer, metadata } = await this.callFlaskChatbot(endpoint, history, {
        userId,
        userType,
        sessionType,
        sessionId: session.id
      }, message, assistantType, files);

      // Save bot response
      await this.saveMessage(session.id, userId, answer, 'bot', 'assistant', metadata);

      // Auto-generate title if this is the first interaction
      let title = null;
      if (session.messageCount === 0) {
        title = this.generateSessionTitle(message);
        await this.sessionRepo.update(session.id, { title });
      }

      return {
        sessionId: session.id,
        answer,
        metadata: {
          ...metadata,
          messageCount: session.messageCount + 2, // +1 for user, +1 for bot
          sessionTitle: session.title || title
        }
      };
    } catch (error) {
      throw new Error(`Failed to process chat: ${error.message}`);
    }
  }

  /**
   * Generate session title from first message
   */
  generateSessionTitle(message) {
    const words = message.split(' ').slice(0, 6);
    let title = words.join(' ');
    if (message.split(' ').length > 6) {
      title += '...';
    }
    return title || 'New Chat Session';
  }

  /**
   * End session
   */
  async endSession(sessionId, userId) {
    try {
      const result = await this.sessionRepo.update(
        { id: sessionId, userId },
        { isActive: false }
      );

      if (result.affected === 0) {
        throw new Error('Session not found or access denied');
      }

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to end session: ${error.message}`);
    }
  }

  /**
   * Delete session and all its messages
   */
  async deleteSession(sessionId, userId) {
    try {
      // First verify ownership
      const session = await this.sessionRepo.findOne({
        where: { id: sessionId, userId }
      });

      if (!session) {
        throw new Error('Session not found or access denied');
      }

      // Delete messages first (due to foreign key constraint)
      await this.messageRepo.delete({ sessionId });

      // Delete session
      await this.sessionRepo.delete({ id: sessionId });

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  }

  /**
   * Get session with messages
   */
  async getSessionWithMessages(sessionId, userId) {
    try {
      const session = await this.sessionRepo.findOne({
        where: { id: sessionId, userId },
        relations: ['messages']
      });
      return session;
    } catch (error) {
      throw new Error(`Failed to get session with messages: ${error.message}`);
    }
  }

  /**
   * Get or create session
   */
  async getOrCreateSession(userId, sessionType, userType) {
    try {
      // Try to find an active session
      let session = await this.sessionRepo.findOne({
        where: {
          userId,
          sessionType,
          isActive: true
        }
      });

      if (!session) {
        session = await this.createSession(userId, userType, sessionType);
      }

      return session;
    } catch (error) {
      throw new Error(`Failed to get or create session: ${error.message}`);
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(sessionId) {
    try {
      const messages = await this.messageRepo.find({
        where: { sessionId },
        order: { createdAt: 'ASC' }
      });

      return messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    } catch (error) {
      throw new Error(`Failed to get conversation history: ${error.message}`);
    }
  }

  /**
   * Save user message
   */
  async saveUserMessage(sessionId, userId, content, role) {
    try {
      return await this.saveMessage(sessionId, userId, content, 'user', role);
    } catch (error) {
      throw new Error(`Failed to save user message: ${error.message}`);
    }
  }

  /**
   * Save bot message
   */
  async saveBotMessage(sessionId, userId, content, metadata, processingTime) {
    try {
      return await this.saveMessage(sessionId, userId, content, 'assistant', 'assistant', {
        ...metadata,
        processingTime
      });
    } catch (error) {
      throw new Error(`Failed to save bot message: ${error.message}`);
    }
  }

  /**
   * Send to Flask backend
   */
  async sendToFlaskBackend(endpoint, history, userContext) {
    try {
      // endpoint may be '/v1/multimodal' or other; forward through callFlaskChatbot
      // If endpoint equals 'chat' or 'doctorchat', translate to multimodal for compatibility
      let resolvedEndpoint = endpoint;
      let message = null;
      let assistantType = null;

      if (endpoint === 'chat' || endpoint === 'doctorchat') {
        resolvedEndpoint = '/v1/multimodal';
      }

      // If userContext contains a message or assistant_type, forward them
      if (userContext && userContext.message) {
        message = userContext.message;
      }
      if (userContext && userContext.assistantType) {
        assistantType = userContext.assistantType;
      }

      // Support files in userContext for forwarding
      const files = userContext && userContext.files ? userContext.files : [];

      return await this.callFlaskChatbot(resolvedEndpoint, history, userContext, message, assistantType, files);
    } catch (error) {
      throw new Error(`Failed to send to Flask backend: ${error.message}`);
    }
  }

  /**
   * Deactivate session
   */
  async deactivateSession(sessionId, userId) {
    try {
      const session = await this.sessionRepo.findOne({
        where: { id: sessionId, userId }
      });

      if (!session) {
        throw new Error('Session not found or access denied');
      }

      session.isActive = false;
      session.endedAt = new Date();
      await this.sessionRepo.save(session);

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to deactivate session: ${error.message}`);
    }
  }
}

module.exports = ChatbotService;
