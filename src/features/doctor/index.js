// src/features/doctor/index.js
// Doctor feature module - exports router, entities, and middlewares

const router = require('./routes');
const entities = require('./entities');
const { doctorOnly } = require('./middlewares/doctorOnly');

module.exports = {
    // Express router for this feature
    router,

    // TypeORM entities for database
    entities,

    // Middlewares
    doctorOnly,

    // Feature metadata
    name: 'doctor',
    version: '1.0.0',
    description: 'Doctor profile, verification, and status management feature'
};
