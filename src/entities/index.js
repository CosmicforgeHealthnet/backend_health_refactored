// src/entities/index.js
// This file is now a thin wrapper around the feature-based entity exports
// Maintained for backward compatibility with TypeORM config
// 
// IMPORT ENTITIES DIRECTLY TO AVOID CIRCULAR DEPENDENCIES WITH REPOSITORIES
// Repositories require AppDataSource -> config/database -> entities/index.js
// If we import features/index.js here, we trigger loading of controllers/services/repos -> cycle!

// Helper to safely import entities
const safeImport = (path) => {
    try {
        const module = require(path);
        return Object.values(module);
    } catch (e) {
        // If module doesn't exist or has error, warn but don't crash yet
        // In verify script we will catch missing modules
        console.warn(`Warning: Could not load entities from ${path}: ${e.message}`);
        return [];
    }
};

const auth = require('../features/auth/entities');
const patient = require('../features/patient/entities');
const doctor = require('../features/doctor/entities');
const appointments = require('../features/appointments/entities');
const chat = require('../features/chat/entities');
const notifications = require('../features/notifications/entities');
const subscriptions = require('../features/subscriptions/entities');
const payments = require('../features/payments/entities');
// const transactions = require('../features/transactions/entities'); // Merged to payments
const support = require('../features/support/entities');
const compliance = require('../features/compliance/entities');
const documents = require('../features/documents/entities');
const firstaid = require('../features/firstaid/entities');
const pharmacy = require('../features/pharmacy/entities');
// Add gamification, marketing, search if they have entities?
// const gamification = require('../features/gamification/entities'); // Check existence first?
// const marketing = require('../features/marketing/entities'); // Check existence first?

/* 
   We explicitly list features we KNOW have entities and are properly structured.
   For verified modules, we require them directly.
*/

module.exports = [
    ...Object.values(auth),
    ...Object.values(patient),
    ...Object.values(doctor),
    ...Object.values(appointments),
    ...Object.values(chat),
    ...Object.values(notifications),
    ...Object.values(subscriptions),
    ...Object.values(payments),
    ...Object.values(support),
    ...Object.values(compliance),
    ...Object.values(documents),
    ...Object.values(firstaid),
    ...Object.values(pharmacy),

    // Check other features if they exist and export entities
    // ...safeImport('../features/gamification/entities'), // Merged to marketing
    ...safeImport('../features/marketing/entities'),
    // ...safeImport('../features/admin/entities'), // Merged to auth/verification
    // ...Object.values(transactions),
    require('../shared/entities/ProfileOption'),
];
