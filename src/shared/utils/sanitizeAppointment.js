const sanitizeAppointment = (appointment) => {
    // Create a copy of the appointment object to avoid mutating the original
    const sanitized = { ...appointment };

    // Remove passwordHash and mfaEnabled from patient
    if (sanitized.patient) {
        const { passwordHash, mfaEnabled, mfaSecret, ...restPatient } = sanitized.patient;
        sanitized.patient = restPatient;
    }

    // Remove passwordHash and mfaEnabled from doctor
    if (sanitized.doctor) {
        const { passwordHash, mfaEnabled, ...restDoctor } = sanitized.doctor;
        sanitized.doctor = restDoctor;
    }
    return sanitized;
};

const sanitizeAppointments = (appointments) => {
    return appointments.map(appointment => sanitizeAppointment(appointment));
};

module.exports = { sanitizeAppointment, sanitizeAppointments };
