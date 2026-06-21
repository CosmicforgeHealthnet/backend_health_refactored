const AiLiveSupportService = require('../services/aiLiveSupportService');

const service = new AiLiveSupportService();

const startSession = async (req, res) => {
  try {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const session = await service.startSession(userId, userRole);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const { sessionId } = req.params;
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const result = await service.sendMessage(sessionId, userId, userRole, message.trim());

    // Notify admin agents via WebSocket when session is escalated
    if (result.escalated) {
      const io = req.app.get('io');
      if (io) {
        io.to('support:agents').emit('support:new_escalation', {
          sessionId,
          userId,
          userRole,
          escalationReason: result.escalationReason,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message === 'Session not found') return res.status(404).json({ success: false, error: error.message });
    if (error.message === 'Session is closed') return res.status(400).json({ success: false, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { sessionId } = req.params;
    const messages = await service.getSessionMessages(sessionId, userId);
    res.json({ success: true, data: messages });
  } catch (error) {
    if (error.message === 'Session not found') return res.status(404).json({ success: false, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

const closeSession = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { sessionId } = req.params;
    const io = req.app.get('io');

    const result = await service.closeSession(sessionId, userId);

    if (io) {
      io.to(`support:session:${sessionId}`).emit('support:session_closed', {
        sessionId,
        closedBy: 'user',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message === 'Session not found') return res.status(404).json({ success: false, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { startSession, sendMessage, getMessages, closeSession };
