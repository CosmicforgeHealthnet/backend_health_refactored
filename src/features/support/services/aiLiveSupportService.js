const AppDataSource = require('../../../config/database');
const GeminiService = require('./geminiService');
const AiSupportContextService = require('./aiSupportContextService');

// User messages containing these phrases trigger immediate human escalation
const ESCALATION_KEYWORDS = [
  'speak to human', 'talk to human', 'real person', 'live agent',
  'live support', 'human agent', 'connect me to', 'speak to someone',
  'i want a human', 'get me a human', 'talk to someone', 'real agent',
  'speak with someone', 'actual person', 'customer service', 'talk with agent'
];

class AiLiveSupportService {
  constructor() {
    this.gemini = new GeminiService();
    this.contextService = new AiSupportContextService();
  }

  get sessionRepo() {
    return AppDataSource.getRepository('AiSupportSession');
  }

  get messageRepo() {
    return AppDataSource.getRepository('AiSupportMessage');
  }

  // ─── User-facing methods ────────────────────────────────────────────────────

  async startSession(userId, userRole) {
    // Reuse any existing active session for this user
    const existing = await this.sessionRepo.findOne({
      where: { userId, status: 'active' }
    });
    if (existing) return existing;

    const session = this.sessionRepo.create({
      userId,
      userRole,
      status: 'active',
      messageCount: 0,
      lastActivityAt: new Date()
    });

    return this.sessionRepo.save(session);
  }

  async sendMessage(sessionId, userId, userRole, content) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, userId } });

    if (!session) throw new Error('Session not found');
    if (session.status === 'closed') throw new Error('Session is closed');

    // Agent has already joined — just save user message, no AI call
    if (session.status === 'agent_joined') {
      const msg = await this._saveMessage(sessionId, userId, 'user', content);
      await this._updateActivity(sessionId);
      return { type: 'agent_session', message: msg };
    }

    // Save user message first
    await this._saveMessage(sessionId, userId, 'user', content);

    // Keyword-triggered escalation (user asked for human)
    if (this._hasEscalationKeyword(content)) {
      const reply = "I'm connecting you to our live support team right away. An agent will be with you shortly — please hold on.";
      await this._saveMessage(sessionId, userId, 'ai', reply);
      await this._escalate(sessionId, 'User requested a human agent');
      await this._updateActivity(sessionId);
      return { type: 'escalated', answer: reply, escalated: true, escalationReason: 'User requested a human agent' };
    }

    // Fetch user data + live context in parallel for AI
    const [userData, liveContext] = await Promise.all([
      this._fetchUser(userId),
      this.contextService.fetchLiveContext(userId, userRole)
    ]);

    const systemPrompt = this.contextService.buildSystemPrompt(userRole, userData, liveContext);
    const history = await this._getHistory(sessionId);

    // Call Gemini
    let aiText;
    try {
      aiText = await this.gemini.generateResponse(systemPrompt, history);
    } catch (error) {
      console.error('[AiLiveSupport] Gemini call failed:', error.message);
      const fallback = "I'm having trouble processing your request right now. Let me connect you with our support team.";
      await this._saveMessage(sessionId, userId, 'ai', fallback);
      await this._escalate(sessionId, 'AI service unavailable');
      await this._updateActivity(sessionId);
      return { type: 'escalated', answer: fallback, escalated: true, escalationReason: 'AI service unavailable' };
    }

    // Check if Gemini decided to escalate (returns JSON with escalate:true)
    const escalation = this._parseEscalation(aiText);
    if (escalation) {
      await this._saveMessage(sessionId, userId, 'ai', escalation.message);
      await this._escalate(sessionId, escalation.reason);
      await this._updateActivity(sessionId);
      return {
        type: 'escalated',
        answer: escalation.message,
        escalated: true,
        escalationReason: escalation.reason
      };
    }

    // Normal AI response
    await this._saveMessage(sessionId, userId, 'ai', aiText);
    await this._updateActivity(sessionId);
    await this.sessionRepo.increment({ id: sessionId }, 'messageCount', 2);

    return { type: 'ai_response', answer: aiText, escalated: false };
  }

  async getSession(sessionId, userId) {
    return this.sessionRepo.findOne({ where: { id: sessionId, userId } });
  }

  async getSessionMessages(sessionId, userId) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, userId } });
    if (!session) throw new Error('Session not found');
    return this.messageRepo.find({ where: { sessionId }, order: { createdAt: 'ASC' } });
  }

  async closeSession(sessionId, userId) {
    const result = await this.sessionRepo.update(
      { id: sessionId, userId },
      { status: 'closed', closedAt: new Date() }
    );
    if (result.affected === 0) throw new Error('Session not found');
    return { success: true };
  }

  // ─── Admin-facing methods ───────────────────────────────────────────────────

  async getEscalationQueue(filters = {}) {
    const qb = this.sessionRepo
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.user', 'user')
      .where("session.status = 'escalated'")
      .orderBy('session.lastActivityAt', 'ASC');

    if (filters.userRole) {
      qb.andWhere('session.userRole = :userRole', { userRole: filters.userRole });
    }

    const sessions = await qb.getMany();

    return sessions.map(s => ({
      id: s.id,
      userId: s.userId,
      userRole: s.userRole,
      userName: s.user?.fullName || 'Unknown',
      userEmail: s.user?.email || 'Unknown',
      escalationReason: s.escalationReason,
      messageCount: s.messageCount,
      waitingSince: s.lastActivityAt,
      createdAt: s.createdAt
    }));
  }

  async claimSession(sessionId, agentId) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, status: 'escalated' }
    });
    if (!session) throw new Error('Session not found or not available for claiming');

    await this.sessionRepo.update(sessionId, {
      status: 'agent_joined',
      agentId,
      lastActivityAt: new Date()
    });

    await this._saveMessage(sessionId, agentId, 'agent', '___AGENT_JOINED___');
    return this.sessionRepo.findOne({ where: { id: sessionId } });
  }

  async sendAgentMessage(sessionId, agentId, content) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, agentId, status: 'agent_joined' }
    });
    if (!session) throw new Error('Session not found or agent not assigned');

    const msg = await this._saveMessage(sessionId, agentId, 'agent', content);
    await this._updateActivity(sessionId);
    return msg;
  }

  async getAdminSessionMessages(sessionId, agentId) {
    // Super admins (agentId check skipped) or assigned agent can read
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new Error('Session not found');
    if (session.agentId && session.agentId !== agentId) throw new Error('Access denied');
    return this.messageRepo.find({ where: { sessionId }, order: { createdAt: 'ASC' } });
  }

  async closeSessionByAgent(sessionId, agentId) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new Error('Session not found');
    if (session.agentId && session.agentId !== agentId) throw new Error('Access denied');
    await this.sessionRepo.update(sessionId, { status: 'closed', closedAt: new Date() });
    return { success: true };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  async _saveMessage(sessionId, senderId, senderType, content, metadata = null) {
    const msg = this.messageRepo.create({ sessionId, senderId, senderType, content, metadata });
    return this.messageRepo.save(msg);
  }

  async _getHistory(sessionId) {
    return this.messageRepo.find({ where: { sessionId }, order: { createdAt: 'ASC' } });
  }

  async _escalate(sessionId, reason) {
    await this.sessionRepo.update(sessionId, { status: 'escalated', escalationReason: reason });
  }

  async _updateActivity(sessionId) {
    await this.sessionRepo.update(sessionId, { lastActivityAt: new Date() });
  }

  async _fetchUser(userId) {
    try {
      const repo = AppDataSource.getRepository('User');
      return await repo.findOne({
        where: { id: userId },
        select: ['id', 'fullName', 'email', 'status', 'createdAt']
      });
    } catch {
      return {};
    }
  }

  _hasEscalationKeyword(message) {
    const lower = message.toLowerCase();
    return ESCALATION_KEYWORDS.some(kw => lower.includes(kw));
  }

  _parseEscalation(text) {
    try {
      const match = text.match(/\{[\s\S]*?"escalate"\s*:\s*true[\s\S]*?\}/);
      if (!match) return null;
      const parsed = JSON.parse(match[0]);
      if (parsed.escalate === true) return parsed;
    } catch {
      // Not valid JSON — AI returned a normal text response
    }
    return null;
  }
}

module.exports = AiLiveSupportService;
