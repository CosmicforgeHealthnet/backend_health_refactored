// src/features/auth/index.js
// Auth feature module - exports router, entities, and middlewares

const router = require('./routes');
const entities = require('./entities');
const { authenticateJWT, authorizeRoles } = require('./middlewares/authMiddleware');
const roleMiddleware = require('./middlewares/roleMiddleware');

module.exports = {
    // Express router for this feature
    router,

    // TypeORM entities for database
    entities,

    // Middlewares
    authenticateJWT,
    authorizeRoles,
    ...roleMiddleware,

    // Feature metadata
    name: 'auth',
    version: '1.0.0',
    description: 'Authentication and authorization feature'
};
