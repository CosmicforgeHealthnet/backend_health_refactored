const express = require("express");
const config = require("../../../config");
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");
const { USER_ROLES } = require("../../../shared/utils/constants");
const { whatsapp, handleIncomingMessage } = require("./index");

const router = express.Router();

const ALLOWED_JWT_ROLES = new Set([USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN]);

function requireSenderAccess(req, res, next) {
  const internalToken = req.get("x-whatsapp-internal-token");

  if (config.whatsapp.internalApiToken) {
    if (internalToken === config.whatsapp.internalApiToken) {
      req.whatsappAccessMode = "internal_token";
      return next();
    }

    if (internalToken) {
      return res.status(403).json({ error: "Invalid WhatsApp internal API token." });
    }
  }

  return authenticateJWT(req, res, () => {
    if (!ALLOWED_JWT_ROLES.has(req.user?.role)) {
      return res.status(403).json({
        error: "Only admin users can access WhatsApp sender routes.",
      });
    }

    req.whatsappAccessMode = "jwt";
    return next();
  });
}

function normalizeServiceType(serviceType) {
  if (!serviceType) {
    return "service";
  }

  return String(serviceType).replace(/[_-]+/g, " ").trim().slice(0, 40) || "service";
}

router.get("/", (req, res) => {
  res.json({
    name: "WhatsApp Cloud API",
    status: "running",
    version: config.whatsapp.apiVersion,
    endpoints: {
      webhook: "GET/POST /webhook",
      health: "GET /health",
      send: "POST /send",
      notify: "POST /send-notification",
      sendTemplate: "POST /send-template (default template only)",
      sendImage: "POST /send-image",
      sendInteractive: "POST /send-interactive",
      broadcast: "POST /broadcast",
      profile: "GET /profile",
    },
  });
});

router.get("/health", async (req, res) => {
  const health = await whatsapp.getHealthStatus();
  res.status(health.configured ? 200 : 503).json(health);
});

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (!config.whatsapp.webhookVerifyToken) {
    return res.status(500).json({
      error: "WHATSAPP_NOTI_WEBHOOK_VERIFY_TOKEN is not configured.",
    });
  }

  if (mode === "subscribe" && token === config.whatsapp.webhookVerifyToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

router.post("/webhook", async (req, res) => {
  try {
    const signatureHeader = req.get("x-hub-signature-256");
    const isValidSignature = whatsapp.verifyWebhookSignature(
      req.rawBody,
      signatureHeader
    );

    if (!isValidSignature) {
      return res.status(401).json({ error: "Invalid WhatsApp webhook signature." });
    }

    const body = req.body;
    if (body?.object !== "whatsapp_business_account") {
      return res.status(200).send("IGNORED");
    }

    const messageResults = [];
    const statuses = [];

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") {
          continue;
        }

        for (const message of change.value?.messages || []) {
          messageResults.push(await handleIncomingMessage(message));
        }

        for (const status of change.value?.statuses || []) {
          statuses.push({
            id: status.id,
            recipientId: status.recipient_id,
            status: status.status,
            timestamp: status.timestamp,
            conversation: status.conversation?.id || null,
            pricingCategory: status.pricing?.category || null,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      processedMessages: messageResults.length,
      processedStatuses: statuses.length,
      messageResults,
      statuses,
    });
  } catch (error) {
    console.error("WhatsApp webhook error:", error.response?.data || error.message);
    return res.status(500).json({
      error: error.message || "Error processing WhatsApp webhook.",
    });
  }
});

router.post("/send", requireSenderAccess, async (req, res) => {
  try {
    const { to, message, previewUrl = false } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        error: "Missing required fields: to, message",
      });
    }

    const result = await whatsapp.sendTextMessage(to, message, { previewUrl });
    return res.json({
      success: true,
      messageId: result.messages?.[0]?.id || null,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
});

router.post("/send-notification", requireSenderAccess, async (req, res) => {
  try {
    const {
      to,
      text,
      recipientName = "Customer",
      serviceType = "service",
      referenceId = "N/A",
      lastInboundAt = null,
      preferFreeform = true,
    } = req.body;

    if (!to || !text) {
      return res.status(400).json({
        error: "Missing required fields: to, text",
      });
    }

    const result = await whatsapp.sendNotification({
      to,
      text,
      recipientName,
      serviceType: normalizeServiceType(serviceType),
      referenceId: String(referenceId || "N/A"),
      lastInboundAt,
      preferFreeform,
    });

    return res.json({
      success: true,
      channel: result.channel,
      withinWindow: result.withinWindow,
      templateName: result.templateName || null,
      messageId: result.response?.messages?.[0]?.id || null,
      result,
    });
  } catch (error) {
    const statusCode =
      error.message?.includes("outside the customer service window") ? 409 : 500;

    return res.status(statusCode).json({
      error: error.message,
    });
  }
});

router.post("/send-template", requireSenderAccess, async (req, res) => {
  try {
    const {
      to,
      recipientName = "Customer",
      serviceType = "service",
      referenceId = "N/A",
    } = req.body;

    if (!to) {
      return res.status(400).json({
        error: "Missing required field: to",
      });
    }

    if (!config.whatsapp.defaultTemplateName) {
      return res.status(409).json({
        error: "WHATSAPP_DEFAULT_TEMPLATE_NAME is not configured.",
      });
    }

    const result = await whatsapp.sendTemplateMessage(
      to,
      config.whatsapp.defaultTemplateName,
      config.whatsapp.defaultTemplateLanguage,
      whatsapp.buildFallbackTemplateComponents({
        recipientName,
        serviceType: normalizeServiceType(serviceType),
        referenceId: String(referenceId || "N/A"),
      })
    );

    return res.json({
      success: true,
      templateName: config.whatsapp.defaultTemplateName,
      messageId: result.messages?.[0]?.id || null,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
});

router.post("/send-image", requireSenderAccess, async (req, res) => {
  try {
    const { to, imageUrl, caption = "" } = req.body;

    if (!to || !imageUrl) {
      return res.status(400).json({
        error: "Missing required fields: to, imageUrl",
      });
    }

    const result = await whatsapp.sendImageMessage(to, imageUrl, caption);
    return res.json({
      success: true,
      messageId: result.messages?.[0]?.id || null,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
});

router.post("/send-interactive", requireSenderAccess, async (req, res) => {
  try {
    const { to, text, buttons } = req.body;

    if (!to || !text || !Array.isArray(buttons) || buttons.length === 0) {
      return res.status(400).json({
        error: "Missing required fields: to, text, buttons (array)",
      });
    }

    const result = await whatsapp.sendInteractiveMessage(to, text, buttons);
    return res.json({
      success: true,
      messageId: result.messages?.[0]?.id || null,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
});

router.post("/broadcast", requireSenderAccess, async (req, res) => {
  try {
    const { numbers, message, delayMs = 1000 } = req.body;

    if (!Array.isArray(numbers) || numbers.length === 0 || !message) {
      return res.status(400).json({
        error: "Missing required fields: numbers (array), message",
      });
    }

    const results = [];
    for (const number of numbers) {
      try {
        const result = await whatsapp.sendTextMessage(number, message);
        results.push({
          number,
          success: true,
          messageId: result.messages?.[0]?.id || null,
        });
      } catch (error) {
        results.push({
          number,
          success: false,
          error: error.response?.data || error.message,
        });
      }

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return res.json({
      success: true,
      totalSent: results.filter((item) => item.success).length,
      totalFailed: results.filter((item) => !item.success).length,
      results,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

router.get("/profile", requireSenderAccess, async (req, res) => {
  try {
    const profile = await whatsapp.getBusinessProfile();
    return res.json(profile);
  } catch (error) {
    return res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
});

module.exports = router;
