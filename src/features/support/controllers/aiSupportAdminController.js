const AiLiveSupportService = require('../services/aiLiveSupportService');

const service = new AiLiveSupportService();

const getQueue = async (req, res) => {
  try {
    const { userRole } = req.query;
    const queue = await service.getEscalationQueue({ userRole });
    res.json({ success: true, data: queue, count: queue.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const claimSession = async (req, res) => {
  try {
    const agentId = req.user.sub;
    const { sessionId } = req.params;
    const io = req.app.get('io');

    const session = await service.claimSession(sessionId, agentId);

    // Tell the user in real time that an agent has joined
    if (io) {
      io.to(`support:session:${sessionId}`).emit('support:agent_joined', {
        sessionId,
        message: 'A support agent has joined the chat.',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, data: session });
  } catch (error) {
    if (error.message.includes('not found')) return res.status(404).json({ success: false, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

const sendAgentMessage = async (req, res) => {
  try {
    const agentId = req.user.sub;
    const { sessionId } = req.params;
    const { message } = req.body;
    const io = req.app.get('io');

    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const msg = await service.sendAgentMessage(sessionId, agentId, message.trim());

    // Deliver agent message to the user in real time
    if (io) {
      io.to(`support:session:${sessionId}`).emit('support:message', {
        sessionId,
        message: msg,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, data: msg });
  } catch (error) {
    if (error.message.includes('not found')) return res.status(404).json({ success: false, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

const getSessionMessages = async (req, res) => {
  try {
    const agentId = req.user.sub;
    const { sessionId } = req.params;
    const messages = await service.getAdminSessionMessages(sessionId, agentId);
    res.json({ success: true, data: messages });
  } catch (error) {
    if (error.message.includes('not found') || error.message === 'Access denied') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

const closeSession = async (req, res) => {
  try {
    const agentId = req.user.sub;
    const { sessionId } = req.params;
    const io = req.app.get('io');

    const result = await service.closeSessionByAgent(sessionId, agentId);

    if (io) {
      io.to(`support:session:${sessionId}`).emit('support:session_closed', {
        sessionId,
        closedBy: 'agent',
        message: 'The support session has been closed by the agent.',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message.includes('not found') || error.message === 'Access denied') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getQueue, claimSession, sendAgentMessage, getSessionMessages, closeSession };
