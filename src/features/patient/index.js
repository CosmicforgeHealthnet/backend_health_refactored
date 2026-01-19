// src/features/patient/index.js
// Patient feature module - exports router, entities, and middlewares

const router = require('./routes');
const entities = require('./entities');
const { patientOnly } = require('./middlewares/patientOnly');

module.exports = {
    // Express router for this feature
    router,

    // TypeORM entities for database
    entities,

    // Middlewares
    patientOnly,

    // Feature metadata
    name: 'patient',
    version: '1.0.0',
    description: 'Patient profile and health records feature'
};
