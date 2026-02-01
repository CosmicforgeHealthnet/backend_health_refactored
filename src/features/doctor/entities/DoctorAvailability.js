// ===================================
// src/entities/doctor/DoctorAvailability.js
// ===================================

const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "DoctorAvailability",
  tableName: "doctor_availability",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    doctorId: {
      type: "uuid",
      nullable: false,
    },
    dayOfWeek: {
      type: "enum",
      enum: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      nullable: false,
    },
    startTime: {
      type: "time",
      nullable: false,
    },
    endTime: {
      type: "time",
      nullable: false,
    },
    isAvailable: {
      type: "boolean",
      default: true,
    },
    maxAppointments: {
      type: "int",
      default: null,
      comment: "Maximum appointments per day (null = unlimited)",
    },
    slotDuration: {
      type: "int",
      default: 30,
      comment: "Duration of each appointment slot in minutes",
    },
    breakTime: {
      type: "int",
      default: 0,
      comment: "Break time between appointments in minutes",
    },
    timezone: {
      type: "varchar",
      length: 100,
      default: "UTC",
    },
    createdAt: {
      type: "timestamp",
      createDate: true,
    },
    updatedAt: {
      type: "timestamp",
      updateDate: true,
    },

    // Store times in doctor's timezone
    startTimeUTC: {
      type: "time",
      nullable: true,
      comment: "Start time converted to UTC for calculations",
    },
    endTimeUTC: {
      type: "time",
      nullable: true,
      comment: "End time converted to UTC for calculations",
    },
  },

  relations: {
    doctor: {
      target: "User",
      type: "many-to-one",
      joinColumn: { name: "doctorId" },
      onDelete: "CASCADE",
      nullable: false,
    },
  },
  indices: [
    {
      name: "IDX_DOCTOR_AVAILABILITY_DOCTOR",
      columns: ["doctorId"],
    },
    {
      name: "IDX_DOCTOR_AVAILABILITY_DAY",
      columns: ["dayOfWeek"],
    },
    {
      name: "IDX_DOCTOR_AVAILABILITY_ACTIVE",
      columns: ["isAvailable"],
    },
  ],
});
