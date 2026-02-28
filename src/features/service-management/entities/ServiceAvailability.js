const { EntitySchema } = require("typeorm");

/**
 * Service status enumeration
 */
const ServiceStatus = {
  ACTIVE: "active",
  DOWN: "down",
};

/**
 * ServiceAvailability Entity
 * Tracks the availability status of platform services with countdown timers
 */
const ServiceAvailability = new EntitySchema({
  name: "ServiceAvailability",
  tableName: "service_availability",

  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid",
    },

    // Unique identifier/key for the service (e.g., "appointments", "pharmacy", "lab")
    serviceKey: {
      type: "varchar",
      length: 100,
      unique: true,
      comment: "Unique key identifier for the service",
    },

    // Human-readable name
    name: {
      type: "varchar",
      length: 255,
      comment: "Display name of the service",
    },

    // Description of the service
    description: {
      type: "text",
      nullable: true,
      comment: "Description of what this service provides",
    },

    // Current status: active or down
    status: {
      type: "enum",
      enum: Object.values(ServiceStatus),
      default: ServiceStatus.ACTIVE,
      comment: "Current availability status of the service",
    },

    // When the service will automatically become available again
    countdownEnd: {
      type: "timestamp with time zone",
      nullable: true,
      comment: "When the service will automatically reactivate (null if active or indefinite downtime)",
    },

    // Reason for downtime (optional)
    downtimeReason: {
      type: "text",
      nullable: true,
      comment: "Reason why the service is currently down",
    },

    // Message to display to users when service is down
    downtimeMessage: {
      type: "text",
      nullable: true,
      comment: "User-facing message during downtime",
    },

    // Whether to show countdown to users
    showCountdown: {
      type: "boolean",
      default: true,
      comment: "Whether to display countdown timer to users",
    },

    // Admin who last updated the status
    lastUpdatedBy: {
      type: "uuid",
      nullable: true,
      comment: "Admin user ID who last updated the service status",
    },

    // Icon or image URL for the service
    iconUrl: {
      type: "varchar",
      length: 500,
      nullable: true,
      comment: "Icon URL for the service",
    },

    // Category for grouping services
    category: {
      type: "varchar",
      length: 100,
      nullable: true,
      comment: "Category for grouping services (e.g., medical, pharmacy, admin)",
    },

    // Display order for sorting
    displayOrder: {
      type: "int",
      default: 0,
      comment: "Order for displaying services in lists",
    },

    // Whether this service is enabled/visible
    isEnabled: {
      type: "boolean",
      default: true,
      comment: "Whether this service is enabled on the platform",
    },

    // Soft delete flag
    isDeleted: {
      type: "boolean",
      default: false,
    },

    createdAt: {
      type: "timestamp with time zone",
      createDate: true,
    },

    updatedAt: {
      type: "timestamp with time zone",
      updateDate: true,
    },
  },

  relations: {
    // Relation to status history
    statusHistory: {
      type: "one-to-many",
      target: "ServiceStatusHistory",
      inverseSide: "service",
    },

    // Relation to admin who last updated
    updatedByUser: {
      type: "many-to-one",
      target: "User",
      joinColumn: {
        name: "lastUpdatedBy",
      },
      nullable: true,
    },
  },

  indices: [
    { columns: ["serviceKey"], unique: true },
    { columns: ["status"] },
    { columns: ["category"] },
    { columns: ["isEnabled"] },
    { columns: ["isDeleted"] },
    { columns: ["countdownEnd"] },
  ],
});

module.exports = ServiceAvailability;
module.exports.ServiceStatus = ServiceStatus;
