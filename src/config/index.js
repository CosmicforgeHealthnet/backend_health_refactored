// src/config/index.js
const fs = require('node:fs');
const path = require('node:path');

const nodeEnv = process.env.NODE_ENV || 'development';
const projectRoot = path.resolve(__dirname, '../..');
const envSpecificPath = path.resolve(projectRoot, `.env.${nodeEnv}`);
const defaultEnvPath = path.resolve(projectRoot, '.env');

require('dotenv').config({
  path: fs.existsSync(envSpecificPath) ? envSpecificPath : defaultEnvPath
});

module.exports = {
  port: process.env.PORT || 3000,
  db: {
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true'
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpires: '15m',
    refreshExpires: '30d'
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI
  },
  corsOrigins: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://localhost:5173', '*', 'https://admin-cosmicforge-healthnet.vercel.app'],
  nodeEnv,
  backendUrl: process.env.BACKEND_URL,
  flaskBackendUrl: process.env.FLASK_BACKEND_URL || 'http://localhost:8000',
  whatsapp: {
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    webhookVerifyToken: process.env.WHATSAPP_NOTI_WEBHOOK_VERIFY_TOKEN,
    appSecret: process.env.WHATSAPP_APP_SECRET,
    internalApiToken: process.env.WHATSAPP_INTERNAL_API_TOKEN,
    defaultTemplateName: process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME || 'service_update_notice',
    defaultTemplateLanguage: process.env.WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE || 'en_US',
    customerServiceWindowHours: Number(process.env.WHATSAPP_CUSTOMER_SERVICE_WINDOW_HOURS || 24),
    autoReplyEnabled: process.env.WHATSAPP_AUTO_REPLY_ENABLED === 'true',
    autoReplyText: process.env.WHATSAPP_AUTO_REPLY_TEXT || 'Thanks for messaging Cosmic Forge Health. We will respond shortly.'
  },
  social: {
    facebook: process.env.SOCIAL_FACEBOOK_URL || 'https://facebook.com/cosmicforgehealthnet',
    linkedin: process.env.SOCIAL_LINKEDIN_URL || 'https://linkedin.com/CosmicForgehealthnetlimited',
    twitter: process.env.SOCIAL_TWITTER_URL || 'https://x.com/cf_healthnet?s=21',
    instagram: process.env.SOCIAL_INSTAGRAM_URL || 'https://instagram.com/cf_healthnet',
    tiktok: process.env.SOCIAL_TIKTOK_URL || 'https://tiktok.com/@cf_healthnet1'
  }
};
