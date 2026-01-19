// src/config/index.js
const path = require('node:path');
require('dotenv').config({
  // if NODE_ENV is unset, default to 'development'
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`)
});

module.exports = {
  port: process.env.PORT || 3000,
  db: {
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpires: '15m',
    refreshExpires: '30d'
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI
  },
   corsOrigins: process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3000', 'http://localhost:5173', '*', 'https://admin-cosmicforge-healthnet.vercel.app'],
  nodeEnv: process.env.NODE_ENV || 'development',
  backendUrl: process.env.BACKEND_URL,
  flaskBackendUrl: process.env.FLASK_BACKEND_URL || 'http://localhost:8000'
};