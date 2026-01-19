const { EntitySchema } = require("typeorm"); // Add missing import if needed, assuming entities use EntitySchema or similar
// Or more likely, re-exporting the files since they are separate files.

const Appointment = require("./Appointment");
const DoctorAvailability = require("./DoctorAvailability");
const DoctorPricing = require("./DoctorPricing");
const DoctorUnavailability = require("./DoctorUnavailability");

module.exports = {
    Appointment,
    DoctorAvailability,
    DoctorPricing,
    DoctorUnavailability,
};
