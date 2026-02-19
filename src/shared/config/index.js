// src/shared/config/index.js
// Re-exports the main config - centralizes configuration access
const path = require('node:path');
require('dotenv').config({
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
    cors: {
        origin: process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.replace(/['"]+/g, '').split(',').map(item => item.trim())
            : ['http://localhost:3000', 'http://localhost:5173', '*', 'https://admin-cosmicforge-healthnet.vercel.app'],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    },
    corsOrigins: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.replace(/['"]+/g, '').split(',').map(item => item.trim())
        : ['http://localhost:3000', 'http://localhost:5173', '*', 'https://admin-cosmicforge-healthnet.vercel.app'],
    nodeEnv: process.env.NODE_ENV || 'development',
    backendUrl: process.env.BACKEND_URL,
    flaskBackendUrl: process.env.FLASK_BACKEND_URL || 'http://localhost:8000'
};
