const config = require("../../../config");
const WhatsAppService = require("./services");

const whatsapp = new WhatsAppService();

function getWebhookEventTimestamp(message = {}) {
  if (!message.timestamp) {
    return new Date();
  }

  const numericTimestamp = Number(message.timestamp);
  if (Number.isNaN(numericTimestamp)) {
    return new Date();
  }

  return new Date(numericTimestamp * 1000);
}

async function handleIncomingMessage(message) {
  const from = whatsapp.formatPhoneNumber(message?.from);
  if (!from) {
    return { handled: false, reason: "missing_sender" };
  }

  const receivedAt = getWebhookEventTimestamp(message);
  await whatsapp.recordLastInboundMessage(from, receivedAt);

  if (message?.id && whatsapp.isConfigured()) {
    try {
      await whatsapp.markAsRead(message.id);
    } catch (error) {
      console.warn(
        `Failed to mark WhatsApp message ${message.id} as read:`,
        error.response?.data || error.message
      );
    }
  }

  if (
    config.whatsapp.autoReplyEnabled &&
    message?.type === "text" &&
    config.whatsapp.autoReplyText
  ) {
    try {
      await whatsapp.sendTextMessage(from, config.whatsapp.autoReplyText);
    } catch (error) {
      console.warn(
        `Failed to send WhatsApp auto-reply to ${from}:`,
        error.response?.data || error.message
      );
    }
  }

  return {
    handled: true,
    from,
    type: message?.type || "unknown",
    receivedAt: receivedAt.toISOString(),
  };
}

module.exports = {
  whatsapp,
  handleIncomingMessage,
};
