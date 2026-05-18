// ===================================
// src/middlewares/appointmentValidationMiddleware.js
// ===================================
const { body, query, param, validationResult } = require("express-validator");

const validateCreateAppointment = [
  // Core Identifiers
  body("patientId")
    .notEmpty()
    .withMessage("Patient ID is required")
    .isUUID()
    .withMessage("Patient ID must be a valid UUID"),
  body("doctorId")
    .notEmpty()
    .withMessage("Doctor ID is required")
    .isUUID()
    .withMessage("Doctor ID must be a valid UUID"),

  // Scheduling Information
  body("appointmentDate")
    .notEmpty()
    .withMessage("Appointment date is required")
    .isDate()
    .withMessage("Appointment date must be a valid date")
    .custom((value) => {
      const now = new Date();
      const appointmentDate = new Date(value);

      // Normalize both dates to the start of the day (midnight) to ignore time differences
      now.setHours(0, 0, 0, 0);
      appointmentDate.setHours(0, 0, 0, 0);

      if (appointmentDate < now) {
        throw new Error("Appointment date cannot be in the past");
      }

      return true;
    }),
  body("appointmentTime")
    .notEmpty()
    .withMessage("Appointment time is required")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Appointment time must be in HH:MM format (24-hour)")
    .custom((value, { req }) => {
      const appointmentDateTime = new Date(
        `${req.body.appointmentDate}T${value}`
      );
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      // if (appointmentDateTime < oneHourFromNow) {
      //   throw new Error(
      //     "Appointment must be scheduled at least 1 hour in advance"
      //   );
      // }

      // const hour = appointmentDateTime.getHours();
      // if (hour < 9 || hour >= 17) {
      //   throw new Error(
      //     "Appointments can only be scheduled between 9:00 AM and 5:00 PM"
      //   );
      // }
      return true;
    }),
  // .custom((value, { req }) => {
  //   const date = new Date(req.body.appointmentDate);
  //   const dayOfWeek = date.getDay();
  //   if (dayOfWeek === 0 || dayOfWeek === 6) {
  //     throw new Error(
  //       "Appointments can only be scheduled on weekdays (Monday to Friday)"
  //     );
  //   }
  //   return true;
  // })
  // body('duration')
  //   .optional()
  //   .isInt({ min: 15, max: 30 })
  //   .withMessage('Duration must be between 15 and 30 minutes')
  //   .toInt(),
  body("duration")
    .optional()
    .custom((value) => {
      const intValue = parseInt(value, 10);
      if (intValue !== 15 && intValue !== 30) {
        throw new Error("Duration must be either 15 or 30 minutes");
      }
      return true;
    })
    .toInt(),

  // Status Management
  body("status")
    .optional()
    .isIn(["pending", "scheduled", "completed", "cancelled", "rescheduled"])
    .withMessage("Invalid status"),
  body("type")
    .optional()
    .isIn(["consultation", "follow-up", "routine-checkup", "urgent"])
    .withMessage("Invalid appointment type"),
  body("priority")
    .optional()
    .isIn(["routine", "urgent", "high"])
    .withMessage("Invalid priority"),

  // Medical Information
  body("reason")
    .notEmpty()
    .withMessage("Reason for consultation is required")
    .isLength({ min: 10, max: 500 })
    .withMessage("Reason must be between 10 and 500 characters"),
  body("notes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters"),
  body("symptoms")
    .optional()
    .isArray()
    .withMessage("Symptoms must be an array")
    .custom((value) => {
      if (value.length > 20) {
        throw new Error("Cannot have more than 20 symptoms");
      }
      value.forEach((symptom) => {
        if (
          typeof symptom !== "string" ||
          symptom.length < 2 ||
          symptom.length > 100
        ) {
          throw new Error(
            "Each symptom must be a string between 2 and 100 characters"
          );
        }
      });
      return true;
    }),

  body("paymentMethod")
    .optional()
    .isIn(["card", "bank_transfer", "wallet", "insurance"])
    .withMessage("Invalid payment method"),

  // Notification Preferences
  body("notificationPreferences.email")
    .optional()
    .isBoolean()
    .withMessage("Email notification preference must be a boolean"),
  body("notificationPreferences.sms")
    .optional()
    .isBoolean()
    .withMessage("SMS notification preference must be a boolean"),
  body("notificationPreferences.push")
    .optional()
    .isBoolean()
    .withMessage("Push notification preference must be a boolean"),

  // Medical Records
  body("isFirstVisit")
    .optional()
    .isBoolean()
    .withMessage("isFirstVisit must be a boolean"),
  body("followUpRequired")
    .optional()
    .isBoolean()
    .withMessage("followUpRequired must be a boolean"),
  body("followUpDate")
    .optional()
    .isDate()
    .withMessage("Follow-up date must be a valid date")
    .custom((value, { req }) => {
      if (req.body.followUpRequired && !value) {
        throw new Error(
          "Follow-up date is required when follow-up is required"
        );
      }
      if (value && new Date(value) < new Date(req.body.appointmentDate)) {
        throw new Error("Follow-up date must be after the appointment date");
      }
      return true;
    }),

  // Metadata
  body("createdBy")
    .optional()
    .isLength({ max: 255 })
    .withMessage("Created by cannot exceed 255 characters"),
  body("timezone")
    .optional()
    .isString()
    .withMessage("Timezone must be a string"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateUpdateAppointment = [
  body("appointmentDate")
    .optional()
    .isDate()
    .withMessage("Appointment date must be a valid date")
    .custom((value) => {
      const now = new Date();
      if (new Date(value) < now) {
        throw new Error("Appointment date cannot be in the past");
      }
      return true;
    }),
  body("appointmentTime")
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Appointment time must be in HH:MM format (24-hour)")
    .custom((value, { req }) => {
      if (!req.body.appointmentDate) return true; // Skip if no date provided
      const appointmentDateTime = new Date(
        `${req.body.appointmentDate}T${value}`
      );
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      if (appointmentDateTime < oneHourFromNow) {
        throw new Error(
          "Appointment must be scheduled at least 1 hour in advance"
        );
      }
      // const hour = appointmentDateTime.getHours();
      // if (hour < 9 || hour >= 17) {
      //   throw new Error(
      //     "Appointments can only be scheduled between 9:00 AM and 5:00 PM"
      //   );
      // }
      return true;
    }),
  // .custom((value, { req }) => {
  //   if (!req.body.appointmentDate) return true; // Skip if no date provided
  //   const date = new Date(req.body.appointmentDate);
  //   const dayOfWeek = date.getDay();
  //   if (dayOfWeek === 0 || dayOfWeek === 6) {
  //     throw new Error(
  //       "Appointments can only be scheduled on weekdays (Monday to Friday)"
  //     );
  //   }
  //   return true;
  // })
  // body("duration")
  //   .optional()
  //   .isInt({ min: 15, max: 240 })
  //   .withMessage("Duration must be between 15 and 240 minutes")
  //   .toInt(),
  body("duration")
    .optional()
    .custom((value) => {
      const intValue = parseInt(value, 10);
      if (intValue !== 15 && intValue !== 30) {
        throw new Error("Duration must be either 15 or 30 minutes");
      }
      return true;
    })
    .toInt(),
  body("status")
    .optional()
    .isIn(["pending", "scheduled", "completed", "cancelled", "rescheduled"])
    .withMessage("Invalid status"),
  body("type")
    .optional()
    .isIn(["consultation", "follow-up", "routine-checkup"])
    .withMessage("Invalid appointment type"),
  body("priority")
    .optional()
    .isIn(["routine", "urgent", "high"])
    .withMessage("Invalid priority"),
  body("reason")
    .optional()
    .isLength({ min: 10, max: 500 })
    .withMessage("Reason must be between 10 and 500 characters"),
  body("notes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters"),
  body("symptoms")
    .optional()
    .isArray()
    .withMessage("Symptoms must be an array")
    .custom((value) => {
      if (value.length > 20) {
        throw new Error("Cannot have more than 20 symptoms");
      }
      value.forEach((symptom) => {
        if (
          typeof symptom !== "string" ||
          symptom.length < 2 ||
          symptom.length > 100
        ) {
          throw new Error(
            "Each symptom must be a string between 2 and 100 characters"
          );
        }
      });
      return true;
    }),
  // body('appointmentMethod')
  //   .optional()
  //   .isIn(['google-meet', 'zoom', 'phone', 'chat'])
  //   .withMessage('Invalid appointment method'),
  // body('consultationFee')
  //   .optional()
  //   .isFloat({ min: 0.01 })
  //   .withMessage('Consultation fee must be a positive number')
  //   .toFloat(),
  body("lastModifiedBy")
    .optional()
    .isLength({ max: 255 })
    .withMessage("Last modified by cannot exceed 255 characters"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateReschedule = [
  body("newDate")
    .notEmpty()
    .withMessage("New appointment date is required")
    .isDate()
    .withMessage("New appointment date must be a valid date")
    .custom((value) => {
      const now = new Date();
      const appointmentDate = new Date(value);

      // Normalize both dates to the start of the day (midnight) to ignore time differences
      now.setHours(0, 0, 0, 0);
      appointmentDate.setHours(0, 0, 0, 0);

      if (appointmentDate < now) {
        throw new Error("New appointment date cannot be in the past");
      }
      return true;
    }),
  body("newTime")
    .notEmpty()
    .withMessage("New appointment time is required")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("New appointment time must be in HH:MM format")
    .custom((value, { req }) => {
      const appointmentDateTime = new Date(`${req.body.newDate}T${value}`);
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      if (appointmentDateTime < oneHourFromNow) {
        throw new Error(
          "Appointment must be scheduled at least 1 hour in advance"
        );
      }
      // const hour = appointmentDateTime.getHours();
      // if (hour < 9 || hour >= 17) {
      //   throw new Error(
      //     "Appointments can only be scheduled between 9:00 AM and 5:00 PM"
      //   );
      // }
      return true;
    }),
  // .custom((value, { req }) => {
  //   const date = new Date(req.body.newDate);
  //   const dayOfWeek = date.getDay();
  //   if (dayOfWeek === 0 || dayOfWeek === 6) {
  //     throw new Error(
  //       "Appointments can only be scheduled on weekdays (Monday to Friday)"
  //     );
  //   }
  //   return true;
  // })
  // body("duration")
  //   .optional()
  //   .isInt({ min: 15, max: 240 })
  //   .withMessage("Duration must be between 15 and 240 minutes")
  //   .toInt(),
  body("duration")
    .optional()
    .custom((value) => {
      const intValue = parseInt(value, 10);
      if (intValue !== 15 && intValue !== 30) {
        throw new Error("Duration must be either 15 or 30 minutes");
      }
      return true;
    })
    .toInt(),
  body("reason")
    .optional()
    .isLength({ min: 5, max: 255 })
    .withMessage("Reschedule reason must be between 5 and 255 characters"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateCancel = [
  body("reason")
    .notEmpty()
    .withMessage("Cancellation reason is required")
    .isLength({ min: 5, max: 500 })
    .withMessage("Cancellation reason must be between 5 and 500 characters"),
  body("refundRequested")
    .optional()
    .isBoolean()
    .withMessage("Refund requested must be a boolean"),
  body("cancelledBy")
    .notEmpty()
    .withMessage("Cancelled by field is required")
    .isLength({ max: 255 })
    .withMessage("Cancelled by cannot exceed 255 characters"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateComplete = [
  body("notes")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Completion notes cannot exceed 2000 characters"),
  body("prescriptions")
    .optional()
    .isArray()
    .withMessage("Prescriptions must be an array")
    .custom((value) => {
      if (value.length > 50) {
        throw new Error("Cannot have more than 50 prescriptions");
      }
      value.forEach((prescription) => {
        if (
          typeof prescription !== "string" ||
          prescription.length < 2 ||
          prescription.length > 200
        ) {
          throw new Error(
            "Each prescription must be a string between 2 and 200 characters"
          );
        }
      });
      return true;
    }),
  body("followUpRequired")
    .optional()
    .isBoolean()
    .withMessage("Follow-up required must be a boolean"),
  body("followUpDate")
    .optional()
    .isDate()
    .withMessage("Follow-up date must be a valid date")
    .custom((value, { req }) => {
      if (req.body.followUpRequired && !value) {
        throw new Error(
          "Follow-up date is required when follow-up is required"
        );
      }
      if (value && new Date(value) < new Date()) {
        throw new Error("Follow-up date cannot be in the past");
      }
      return true;
    }),
  body("labOrdersRequired")
    .optional()
    .isArray()
    .withMessage("Lab orders must be an array")
    .custom((value) => {
      if (value.length > 20) {
        throw new Error("Cannot have more than 20 lab orders");
      }
      value.forEach((order) => {
        if (
          typeof order !== "string" ||
          order.length < 2 ||
          order.length > 200
        ) {
          throw new Error(
            "Each lab order must be a string between 2 and 200 characters"
          );
        }
      });
      return true;
    }),
  body("completedBy")
    .notEmpty()
    .optional()
    .withMessage("Completed by field is required")
    .isLength({ max: 255 })
    .withMessage("Completed by cannot exceed 255 characters"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

const validatePayment = [
  body("paymentMethod")
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(["card", "bank_transfer", "wallet", "insurance"])
    .withMessage("Invalid payment method"),
  body("paymentToken")
    .notEmpty()
    .withMessage("Payment token is required")
    .isLength({ min: 10, max: 500 })
    .withMessage("Payment token must be between 10 and 500 characters"),
  body("amount")
    .notEmpty()
    .withMessage("Payment amount is required")
    .isFloat({ min: 0.01 })
    .withMessage("Payment amount must be a positive number")
    .toFloat(),
  body("currency")
    .optional()
    .isIn(["NGN", "USD", "EUR", "GBP"])
    .withMessage("Invalid currency"),
  body("description")
    .optional()
    .isLength({ max: 255 })
    .withMessage("Description cannot exceed 255 characters"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateMeeting = [
  body("provider")
    .notEmpty()
    .withMessage("Meeting provider is required")
    .isIn(["google", "zoom"])
    .withMessage("Meeting provider must be either google or zoom"),
  body("timezone")
    .optional()
    .isString()
    .withMessage("Timezone must be a string"),
  body("requirePassword")
    .optional()
    .isBoolean()
    .withMessage("Require password must be a boolean"),
  body("waitingRoom")
    .optional()
    .isBoolean()
    .withMessage("Waiting room must be a boolean"),
  body("doctorToken")
    .notEmpty()
    .withMessage("Doctor authentication token is required")
    .isLength({ min: 20 })
    .withMessage("Doctor token must be at least 20 characters"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateFilters = [
  query("patientId")
    .optional()
    .isUUID()
    .withMessage("Patient ID must be a valid UUID"),
  query("doctorId")
    .optional()
    .isUUID()
    .withMessage("Doctor ID must be a valid UUID"),
  query("status")
    .optional()
    .isIn(["pending", "scheduled", "completed", "cancelled", "rescheduled"])
    .withMessage("Invalid status"),
  query("appointmentDate")
    .optional()
    .isDate()
    .withMessage("Appointment date must be a valid date"),
  query("paymentStatus")
    .optional()
    .isIn(["pending", "completed", "failed", "refunded"])
    .withMessage("Invalid payment status"),
  query("startDate")
    .optional()
    .isDate()
    .withMessage("Start date must be a valid date"),
  query("endDate")
    .optional()
    .isDate()
    .withMessage("End date must be a valid date")
    .custom((value, { req }) => {
      if (
        req.query.startDate &&
        value &&
        new Date(value) < new Date(req.query.startDate)
      ) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

const validatePatientDoctorParams = [
  param("patientId")
    .notEmpty()
    .withMessage("Patient ID is required")
    .isUUID()
    .withMessage("Patient ID must be a valid UUID"),
  param("doctorId")
    .notEmpty()
    .withMessage("Doctor ID is required")
    .isUUID()
    .withMessage("Doctor ID must be a valid UUID"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

module.exports = {
  validateCreateAppointment,
  validateUpdateAppointment,
  validateReschedule,
  validateCancel,
  validateComplete,
  validatePayment,
  validateMeeting,
  validateFilters,
  validatePatientDoctorParams
};
