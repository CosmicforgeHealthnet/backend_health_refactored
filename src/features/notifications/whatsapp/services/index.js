const axios = require("axios");
const crypto = require("node:crypto");
const config = require("../../../../config");
const cache = require("../../../../shared/utils/cache");

class WhatsAppService {
  constructor() {
    this.config = config.whatsapp;
    this.baseURL = `https://graph.facebook.com/${this.config.apiVersion}`;
    this.windowCachePrefix = "whatsapp:last_inbound:";
  }

  isConfigured() {
    return Boolean(this.config.accessToken && this.config.phoneNumberId);
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new Error(
        "WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID."
      );
    }
  }

  formatPhoneNumber(phoneNumber) {
    return String(phoneNumber || "").replace(/[^\d]/g, "");
  }

  buildMessagesUrl() {
    this.assertConfigured();
    return `${this.baseURL}/${this.config.phoneNumberId}/messages`;
  }

  getRequestHeaders() {
    this.assertConfigured();
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  getTemplateBodyComponent(values = []) {
    if (!values.length) {
      return [];
    }

    return [
      {
        type: "body",
        parameters: values.map((value) => ({
          type: "text",
          text: String(value),
        })),
      },
    ];
  }

  async sendTextMessage(to, text, options = {}) {
    const phoneNumber = this.formatPhoneNumber(to);
    if (!phoneNumber || !text) {
      throw new Error("Both 'to' and 'text' are required to send a WhatsApp text message.");
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "text",
      text: {
        body: String(text),
        preview_url: Boolean(options.previewUrl),
      },
    };

    if (options.replyToMessageId) {
      payload.context = { message_id: options.replyToMessageId };
    }

    const response = await axios.post(this.buildMessagesUrl(), payload, {
      headers: this.getRequestHeaders(),
    });

    return response.data;
  }

  async sendTemplateMessage(
    to,
    templateName,
    languageCode = this.config.defaultTemplateLanguage,
    components = []
  ) {
    const phoneNumber = this.formatPhoneNumber(to);
    if (!phoneNumber || !templateName) {
      throw new Error("Both 'to' and 'templateName' are required to send a WhatsApp template message.");
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
      },
    };

    if (components.length > 0) {
      payload.template.components = components;
    }

    const response = await axios.post(this.buildMessagesUrl(), payload, {
      headers: this.getRequestHeaders(),
    });

    return response.data;
  }

  async sendImageMessage(to, imageUrl, caption = "") {
    const phoneNumber = this.formatPhoneNumber(to);
    if (!phoneNumber || !imageUrl) {
      throw new Error("Both 'to' and 'imageUrl' are required to send a WhatsApp image message.");
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "image",
      image: {
        link: imageUrl,
      },
    };

    if (caption) {
      payload.image.caption = caption;
    }

    const response = await axios.post(this.buildMessagesUrl(), payload, {
      headers: this.getRequestHeaders(),
    });

    return response.data;
  }

  async sendInteractiveMessage(to, bodyText, buttons) {
    const phoneNumber = this.formatPhoneNumber(to);
    if (!phoneNumber || !bodyText || !Array.isArray(buttons) || buttons.length === 0) {
      throw new Error("Valid 'to', 'bodyText', and non-empty 'buttons' are required for an interactive message.");
    }

    const normalizedButtons = buttons.slice(0, 3).map((button, index) => {
      if (typeof button === "string") {
        return {
          type: "reply",
          reply: {
            id: `btn_${index}`,
            title: button.slice(0, 20),
          },
        };
      }

      return {
        type: "reply",
        reply: {
          id: String(button.id || `btn_${index}`),
          title: String(button.title || button.label || `Option ${index + 1}`).slice(0, 20),
        },
      };
    });

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: String(bodyText),
        },
        action: {
          buttons: normalizedButtons,
        },
      },
    };

    const response = await axios.post(this.buildMessagesUrl(), payload, {
      headers: this.getRequestHeaders(),
    });

    return response.data;
  }

  async markAsRead(messageId) {
    if (!messageId) {
      throw new Error("'messageId' is required to mark a WhatsApp message as read.");
    }

    const payload = {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    };

    const response = await axios.post(this.buildMessagesUrl(), payload, {
      headers: this.getRequestHeaders(),
    });

    return response.data;
  }

  async getBusinessProfile() {
    this.assertConfigured();

    const response = await axios.get(
      `${this.baseURL}/${this.config.phoneNumberId}`,
      {
        params: {
          fields: "verified_name,display_phone_number,quality_rating",
        },
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
        },
      }
    );

    return response.data;
  }

  async getLastInboundMessageAt(phoneNumber) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      return null;
    }

    return cache.get(`${this.windowCachePrefix}${formattedPhone}`);
  }

  async recordLastInboundMessage(phoneNumber, timestamp = new Date()) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      return null;
    }

    const value = new Date(timestamp).toISOString();
    await cache.set(`${this.windowCachePrefix}${formattedPhone}`, value, 35 * 24 * 60 * 60);
    return value;
  }

  async isWithinCustomerServiceWindow(phoneNumber, explicitTimestamp = null) {
    const sourceTimestamp =
      explicitTimestamp || (await this.getLastInboundMessageAt(phoneNumber));

    if (!sourceTimestamp) {
      return false;
    }

    const lastInboundAt = new Date(sourceTimestamp);
    if (Number.isNaN(lastInboundAt.getTime())) {
      return false;
    }

    const windowMs =
      Number(this.config.customerServiceWindowHours || 24) * 60 * 60 * 1000;

    return Date.now() - lastInboundAt.getTime() <= windowMs;
  }

  buildFallbackTemplateComponents({ recipientName, serviceType, referenceId }) {
    return this.getTemplateBodyComponent([
      recipientName || "Customer",
      serviceType || "service",
      referenceId || "N/A",
    ]);
  }

  async sendNotification({
    to,
    text,
    recipientName = "Customer",
    serviceType = "service",
    referenceId = "N/A",
    lastInboundAt = null,
    preferFreeform = true,
  }) {
    const phoneNumber = this.formatPhoneNumber(to);
    if (!phoneNumber) {
      throw new Error("'to' is required to send a WhatsApp notification.");
    }

    const withinWindow =
      preferFreeform &&
      text &&
      (await this.isWithinCustomerServiceWindow(phoneNumber, lastInboundAt));

    if (withinWindow) {
      const response = await this.sendTextMessage(phoneNumber, text);
      return {
        channel: "session_text",
        withinWindow: true,
        response,
      };
    }

    const fallbackTemplateName = this.config.defaultTemplateName;
    if (!fallbackTemplateName) {
      throw new Error(
        "Recipient is outside the customer service window and no approved fallback template is configured."
      );
    }

    const response = await this.sendTemplateMessage(
      phoneNumber,
      fallbackTemplateName,
      this.config.defaultTemplateLanguage,
      this.buildFallbackTemplateComponents({
        recipientName,
        serviceType,
        referenceId,
      })
    );

    return {
      channel: "template",
      withinWindow: false,
      templateName: fallbackTemplateName,
      response,
    };
  }

  verifyWebhookSignature(rawBody, signatureHeader) {
    if (!this.config.appSecret) {
      throw new Error("WHATSAPP_APP_SECRET is required to verify webhook signatures.");
    }

    if (!rawBody || !signatureHeader || !signatureHeader.startsWith("sha256=")) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.config.appSecret)
      .update(rawBody)
      .digest("hex");

    const receivedSignature = signatureHeader.slice("sha256=".length);
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(receivedSignature, "hex");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  async getHealthStatus() {
    return {
      ok: true,
      configured: this.isConfigured(),
      apiVersion: this.config.apiVersion,
      phoneNumberIdConfigured: Boolean(this.config.phoneNumberId),
      accessTokenConfigured: Boolean(this.config.accessToken),
      webhookVerifyTokenConfigured: Boolean(this.config.webhookVerifyToken),
      webhookSignatureConfigured: Boolean(this.config.appSecret),
      internalApiTokenConfigured: Boolean(this.config.internalApiToken),
      defaultTemplateConfigured: Boolean(this.config.defaultTemplateName),
      customerServiceWindowHours: Number(this.config.customerServiceWindowHours || 24),
    };
  }
}

module.exports = WhatsAppService;