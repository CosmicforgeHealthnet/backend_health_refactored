// ===================================
// src/entities/appointment/Appointment.js
// ===================================

const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Appointment",
  tableName: "appointments",
  columns: {
    // Core Identifiers
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    patientId: {
      type: "uuid",
      nullable: false,
    },
    doctorId: {
      type: "uuid",
      nullable: false,
    },

    // Scheduling Information
    appointmentDate: {
      type: "date",
      nullable: false,
    },
    appointmentTime: {
      type: "time",
      nullable: false,
    },
    duration: {
      type: "int",
      default: 30,
      comment: "Duration in minutes",
    },
    endTime: {
      type: "time",
      nullable: true,
      comment: "Auto-calculated end time",
    },
    // Status Management
    status: {
      type: "enum",
      enum: ["pending", "scheduled", "completed", "cancelled", "rescheduled"],
      default: "pending",
    },
    type: {
      type: "enum",
      enum: ["consultation", "follow-up", "routine-checkup", "urgent"],
      default: "consultation",
    },
    priority: {
      type: "enum",
      enum: ["routine", "urgent", "high"],
      default: "routine",
    },

    // Medical Information
    reason: {
      type: "text",
      nullable: false,
    },
    notes: {
      type: "text",
      nullable: true,
    },
    symptoms: {
      type: "jsonb",
      nullable: true,
      comment: "Array of reported symptoms",
    },

    meetingProvider: {
      type: "enum",
      enum: ["google", "zoom", "jitsi"],
      nullable: true,
    },
    meetingLink: {
      type: "varchar",
      length: 500,
      nullable: true,
    },
    meetingId: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    meetingPassword: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    googleMeetCode: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    zoomMeetingId: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    hostKey: {
      type: "varchar",
      length: 255,
      nullable: true,
    },

    // Financial Information
    consultationFee: {
      type: "decimal",
      precision: 10,
      scale: 2,
      nullable: false,
    },

    consultationFeeCurrency: {
      type: 'varchar',
      length: 3,
      default: 'NGN'
    },
    paymentStatus: {
      type: "enum",
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    paymentId: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    paymentMethod: {
      type: "varchar",
      length: 100,
      nullable: true,
    },
    insuranceCovered: {
      type: "boolean",
      default: false,
    },
    copay: {
      type: "decimal",
      precision: 10,
      scale: 2,
      nullable: true,
    },

    // Notification Management
    reminderSent: {
      type: "boolean",
      default: false,
    },
    reminderSentAt: {
      type: "timestamp",
      nullable: true,
    },
    notificationPreferences: {
      type: "jsonb",
      nullable: true,
      comment: "JSON object with email, sms, push preferences",
    },

    // Medical Records
    isFirstVisit: {
      type: "boolean",
      default: true,
    },
    followUpRequired: {
      type: "boolean",
      default: false,
    },
    followUpDate: {
      type: "date",
      nullable: true,
    },
    prescriptions: {
      type: "jsonb",
      nullable: true,
      comment: "Array of prescribed medications",
    },
    labOrdersRequired: {
      type: "jsonb",
      nullable: true,
      comment: "Array of required lab tests",
    },

    // Metadata
    createdAt: {
      type: "timestamp",
      createDate: true,
    },
    updatedAt: {
      type: "timestamp",
      updateDate: true,
    },
    createdBy: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    lastModifiedBy: {
      type: "varchar",
      length: 255,
      nullable: true,
    },

    // Cancellation/Completion
    completedAt: {
      type: "timestamp",
      nullable: true,
    },
    cancelledAt: {
      type: "timestamp",
      nullable: true,
    },
    cancellationReason: {
      type: "text",
      nullable: true,
    },
    cancelledBy: {
      type: "varchar",
      length: 255,
      nullable: true,
    },

    //new entity
    rescheduledAt: {
      type: "timestamp",
      nullable: true,
    },
    rescheduledBy: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    rescheduleReason: {
      type: "text",
      nullable: true,
    },
    isDoctorApproved: {
      type: "boolean",
      default: false,
    },
    isCancelled: {
      type: "boolean",
      default: false,
    },

    // Store appointment time in UTC for consistency
    appointmentTimeUTC: {
      type: "timestamp",
      nullable: true,
      comment:
        "Appointment time stored in UTC for timezone-independent storage",
    },

    // Timezone context for both parties
    doctorTimezone: {
      type: "varchar",
      length: 100,
      nullable: true,
      comment: "Doctor's timezone when appointment was created",
    },
    patientTimezone: {
      type: "varchar",
      length: 100,
      nullable: true,
      comment: "Patient's timezone when appointment was created",
    },

    // Original times in local timezones (for reference)
    doctorLocalTime: {
      type: "time",
      nullable: true,
      comment: "Appointment time in doctor's local timezone",
    },
    patientLocalTime: {
      type: "time",
      nullable: true,
      comment: "Appointment time in patient's local timezone",
    },

    endTimeUTC: {
      type: "timestamp",
      nullable: true, 
      comment: "End time converted to UTC for calculations"
    }
  
  },

  relations: {
    doctor: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",
      joinColumn: { name: "doctorId", referencedColumnName: "id" },
    },
    patient: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",
      joinColumn: { name: "patientId", referencedColumnName: "id" },
    },

    appointmentChat: {
      target: "AppointmentChat",
      type: "one-to-one",
      nullable: true,
      inverseSide: "appointment",
    },
  },

  indices: [
    {
      name: "IDX_APPOINTMENT_PATIENT",
      columns: ["patientId"],
    },
    {
      name: "IDX_APPOINTMENT_DOCTOR",
      columns: ["doctorId"],
    },
    {
      name: "IDX_APPOINTMENT_DATE",
      columns: ["appointmentDate"],
    },
    {
      name: "IDX_APPOINTMENT_STATUS",
      columns: ["status"],
    },
    {
      name: "IDX_APPOINTMENT_PAYMENT_STATUS",
      columns: ["paymentStatus"],
    },
    {
      name: "IDX_APPOINTMENT_DATE_TIME",
      columns: ["appointmentDate", "appointmentTime"],
    },
    {
      name: "IDX_APPOINTMENT_DOCTOR_DATE",
      columns: ["doctorId", "appointmentDate"],
    },
  ],
});
