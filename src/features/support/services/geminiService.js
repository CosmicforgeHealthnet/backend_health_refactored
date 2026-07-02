const axios = require('axios');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
  }

  async generateResponse(systemPrompt, conversationHistory) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    // Gemini requires at least one user message in contents
    // Convert history: senderType 'user' -> role 'user', anything else -> role 'model'
    const contents = conversationHistory.map(msg => ({
      role: msg.senderType === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Gemini requires the last message to be from the user
    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
      throw new Error('Last message must be from user');
    }

    const payload = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        topP: 0.95
      }
    };

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${this.apiKey}`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    return text.trim();
  }
}

module.exports = GeminiService;
