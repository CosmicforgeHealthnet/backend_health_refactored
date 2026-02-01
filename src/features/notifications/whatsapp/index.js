// Complete WhatsApp Business API Server
const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// WhatsApp Business API Configuration
const GRAPH_API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Validate environment variables
if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
  console.error("❌ Missing required environment variables:");
  console.error("   WHATSAPP_ACCESS_TOKEN");
  console.error("   WHATSAPP_PHONE_NUMBER_ID");
  process.exit(1);
}

// WhatsApp Business API Service Class
class WhatsAppBusinessAPI {
  constructor() {
    this.baseURL = BASE_URL;
    this.phoneNumberId = PHONE_NUMBER_ID;
    this.accessToken = ACCESS_TOKEN;
  }

  // Send text message
  async sendTextMessage(to, text) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "text",
        // type: "template",
        // template: {
        //   "name": "hello_world",
        //   "language": {
        //     "code": "en_US"
        //   }
        // },
    
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(
        "Error sending text message:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Send template message
  async sendTemplateMessage(
    to,
    templateName,
    languageCode = "en_US",
    parameters = []
  ) {
    try {
      const templatePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
        },
      };

      // Add parameters if provided
      if (parameters.length > 0) {
        templatePayload.template.components = [
          {
            type: "body",
            parameters: parameters.map((param) => ({
              type: "text",
              text: param,
            })),
          },
        ];
      }

      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        templatePayload,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(
        "Error sending template message:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Send image message
  async sendImageMessage(to, imageUrl, caption = "") {
    try {
      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "image",
          image: {
            link: imageUrl,
            caption: caption,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(
        "Error sending image message:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Send interactive button message
  async sendInteractiveMessage(to, bodyText, buttons) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: bodyText },
            action: {
              buttons: buttons.map((button, index) => ({
                type: "reply",
                reply: {
                  id: `btn_${index}`,
                  title: button,
                },
              })),
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(
        "Error sending interactive message:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Mark message as read
  async markAsRead(messageId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(
        "Error marking message as read:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Get business profile
  async getBusinessProfile() {
    try {
      const response = await axios.get(
        `${this.baseURL}/${this.phoneNumberId}`,
        {
          params: {
            fields: "verified_name,display_phone_number,quality_rating",
          },
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(
        "Error getting business profile:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
}

// Initialize WhatsApp API
const whatsapp = new WhatsAppBusinessAPI();

// Routes

// Handle incoming messages
async function handleIncomingMessage(message) {
  try {
    const from = message.from;
    const messageId = message.id;
    const messageType = message.type;

    // Mark message as read
    await whatsapp.markAsRead(messageId);

    // Handle different message types
    if (messageType === "text") {
      const text = message.text.body.toLowerCase().trim();
      await handleTextMessage(from, text, messageId);
    } else if (messageType === "interactive") {
      const buttonId = message.interactive.button_reply.id;
      await handleButtonClick(from, buttonId);
    } else if (messageType === "image") {
      await whatsapp.sendTextMessage(from, "📸 Thanks for the image!");
    } else {
      await whatsapp.sendTextMessage(from, "👋 Thanks for your message!");
    }
  } catch (error) {
    console.error("Error handling message:", error);
  }
}

// Handle text messages with commands
async function handleTextMessage(from, text, messageId) {
  try {
    let response = "";

    switch (text) {
      case "hello":
      case "hi":
        response =
          'Hello! 👋 Welcome to our WhatsApp Business API bot. Type "help" to see available commands.';
        break;

      case "help":
        response = `*Available Commands:* 📋
                    • *hello* - Say hello
                    • *help* - Show this menu
                    • *time* - Get current time
                    • *joke* - Get a random joke
                    • *buttons* - See interactive buttons
                    • *info* - Get business information
                    • *support* - Contact support
                    Just type any command to get started! 🚀`;
        break;

      case "time": {
        const now = new Date().toLocaleString();
        response = `🕐 Current time: ${now}`;
        break;
      }

      case "joke": {
        const jokes = [
          "Why don't scientists trust atoms? Because they make up everything! 😄",
          "What do you call a bear with no teeth? A gummy bear! 🐻",
          "Why did the math book look so sad? Because it had too many problems! 📚",
          "What do you call a fake noodle? An impasta! 🍝",
        ];
        response = jokes[Math.floor(Math.random() * jokes.length)];
        break;
      }

      case "buttons":
        await whatsapp.sendInteractiveMessage(from, "Choose an option below:", [
          "🛍️ Products",
          "📞 Support",
          "💬 Feedback",
        ]);
        return;

      case "info": {
        const profile = await whatsapp.getBusinessProfile();
        response = `*Business Information:* 🏢
                
                Name: ${profile.verified_name || "N/A"}
                Phone: ${profile.display_phone_number || "N/A"}
                Quality Rating: ${profile.quality_rating || "N/A"}`;
        break;
      }

      case "support":
        response =
          "🛟 *Support Request*\n\nA support agent will contact you shortly. In the meantime, please describe your issue and we'll get back to you as soon as possible.";
        break;

      default:
        if (text.includes("product") || text.includes("buy")) {
          response =
            "🛍️ Thanks for your interest! Our products catalog will be available soon. Contact support for more information.";
        } else if (text.includes("price") || text.includes("cost")) {
          response =
            "💰 For pricing information, please contact our sales team or visit our website.";
        } else {
          response =
            '🤖 Thanks for your message! Type "help" to see available commands, or contact "support" for assistance.';
        }
    }

    await whatsapp.sendTextMessage(from, response);
  } catch (error) {
    console.error("Error handling text message:", error);
    await whatsapp.sendTextMessage(
      from,
      "Sorry, there was an error processing your request. Please try again."
    );
  }
}

// Handle button clicks
async function handleButtonClick(from, buttonId) {
  try {
    let response = "";

    switch (buttonId) {
      case "btn_0": // Products
        response =
          '🛍️ Here are our products:\n\n1. Product A - $99\n2. Product B - $149\n3. Product C - $199\n\nType "support" to speak with sales.';
        break;
      case "btn_1": // Support
        response =
          "📞 Support Request Received!\n\nA support agent will contact you within 24 hours. Please describe your issue:";
        break;
      case "btn_2": // Feedback
        response =
          "💬 We value your feedback!\n\nPlease share your thoughts about our service:";
        break;
      default:
        response = 'Thanks for clicking! Type "help" for available commands.';
    }

    await whatsapp.sendTextMessage(from, response);
  } catch (error) {
    console.error("Error handling button click:", error);
  }
}

module.exports = {
  whatsapp,
  handleIncomingMessage,
};
