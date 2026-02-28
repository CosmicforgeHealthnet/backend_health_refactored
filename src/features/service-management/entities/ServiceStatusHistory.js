const { EntitySchema } = require("typeorm");

/**
 * Status change action types
 */
const StatusChangeAction = {
  MANUAL_DOWN: "manual_down",           // Admin manually set service to down
  MANUAL_ACTIVE: "manual_active",       // Admin manually set service to active
  AUTO_REACTIVATED: "auto_reactivated", // System auto-reactivated after countdown
  COUNTDOWN_EXTENDED: "countdown_extended", // Admin extended the countdown
  COUNTDOWN_SHORTENED: "countdown_shortened", // Admin shortened the countdown
  OVERRIDE_ACTIVE: "override_active",   // Admin overrode countdown to bring back early
  CREATED: "created",                   // Service was created
};

/**
 * ServiceStatusHistory Entity
 * Tracks all status changes for audit and analytics purposes
 */
const ServiceStatusHistory = new EntitySchema({
  name: "ServiceStatusHistory",
  tableName: "service_status_history",

  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid",
    },

    // Reference to the service
    serviceId: {
      type: "uuid",
      comment: "Reference to ServiceAvailability",
    },

    // Previous status before change
    previousStatus: {
      type: "varchar",
      length: 50,
      nullable: true,
      comment: "Status before the change (null for creation)",
    },

    // New status after change
    newStatus: {
      type: "varchar",
      length: 50,
      comment: "Status after the change",
    },

    // Type of action that caused the change
    action: {
      type: "enum",
      enum: Object.values(StatusChangeAction),
      comment: "Type of action that triggered the status change",
    },

    // Previous countdown end (for tracking extensions)
    previousCountdownEnd: {
      type: "timestamp with time zone",
      nullable: true,
      comment: "Previous countdown end time before change",
    },

    // New countdown end
    newCountdownEnd: {
      type: "timestamp with time zone",
      nullable: true,
      comment: "New countdown end time after change",
    },

    // Reason provided by admin
    reason: {
      type: "text",
      nullable: true,
      comment: "Reason for the status change",
    },

    // Admin who made the change (null for auto-reactivation)
    changedBy: {
      type: "uuid",
      nullable: true,
      comment: "Admin user ID who made the change (null for system actions)",
    },

    // Whether notifications were sent for this change
    notificationsSent: {
      type: "boolean",
      default: false,
      comment: "Whether users were notified about this change",
    },

    // Count of notifications sent
    notificationCount: {
      type: "int",
      default: 0,
      comment: "Number of notifications sent for this change",
    },

    // Duration of downtime in minutes (calculated when service comes back up)
    downtimeDurationMinutes: {
      type: "int",
      nullable: true,
      comment: "Total downtime duration in minutes (set when service comes back up)",
    },

    // IP address of admin (for audit trail)
    ipAddress: {
      type: "varchar",
      length: 45,
      nullable: true,
      comment: "IP address of the admin who made the change",
    },

    // User agent of admin (for audit trail)
    userAgent: {
      type: "text",
      nullable: true,
      comment: "User agent string of the admin's browser",
    },

    // Additional metadata
    metadata: {
      type: "json",
      nullable: true,
      comment: "Additional metadata about the change",
    },

    createdAt: {
      type: "timestamp with time zone",
      createDate: true,
    },
  },

  relations: {
    // Relation to the service
    service: {
      type: "many-to-one",
      target: "ServiceAvailability",
      joinColumn: {
        name: "serviceId",
      },
      inverseSide: "statusHistory",
      onDelete: "CASCADE",
    },

    // Relation to admin who made the change
    changedByUser: {
      type: "many-to-one",
      target: "User",
      joinColumn: {
        name: "changedBy",
      },
      nullable: true,
    },
  },

  indices: [
    { columns: ["serviceId"] },
    { columns: ["action"] },
    { columns: ["changedBy"] },
    { columns: ["createdAt"] },
    { columns: ["newStatus"] },
  ],
});

module.exports = ServiceStatusHistory;
module.exports.StatusChangeAction = StatusChangeAction;
