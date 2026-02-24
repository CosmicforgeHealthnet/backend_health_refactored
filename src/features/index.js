// src/features/index.js
// Central export for all features - makes importing easier

const auth = require('./auth');
const patient = require('./patient');
const doctor = require('./doctor');

// Features that need to be moved/refactored
const appointments = require('./appointments');
const chat = require('./chat');
const payments = require('./payments');
// const subscriptions = require('./subscriptions');
const pharmacy = require('./pharmacy');
// const lab = require('../shared/services/email/helper/lab');
const firstaid = require('./firstaid');
const notifications = require('./notifications');
const support = require('./support');
// const notifications = require('./notifications');
const subscriptions = require('./subscriptions');
// const support = require('./support');
const compliance = require('./compliance');
const documents = require('./documents');

module.exports = {
    auth,
    patient,
    doctor,
    appointments,
    chat,
    notifications,
    subscriptions,
    payments,
    support,
    compliance,
    documents,

    // All feature entities combined for TypeORM
    getAllEntities() {
        return [
            ...Object.values(auth.entities),
            ...Object.values(patient.entities),
            ...Object.values(doctor.entities),
            ...Object.values(appointments.entities),
            ...Object.values(chat.entities),
            ...Object.values(notifications.entities),
            ...Object.values(subscriptions.entities),
            ...Object.values(payments.entities),
            ...Object.values(support.entities),
            ...Object.values(compliance.entities),
            ...Object.values(documents.entities),
            ...Object.values(firstaid.entities),
            ...Object.values(pharmacy.entities),
            // Add other feature entities here as they are refactored
        ];
    }
};
