const { EntitySchema } = require("typeorm");
const User = require("../../auth/entities/User");

module.exports = new EntitySchema({
  name: "Notification",
  tableName: "notification",

  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid",
    },

    // Type of notification (e.g., "alert", "notification",)
    type: {
      type: "varchar",
      length: 50,
    },

    // The actual message or content of the notification
    message: {
      type: "text",
    },

    // Whether the user has read the notification or not
    isRead: {
      type: "boolean",
      default: false, // default is "unread"
    },

    // Extra flexible data in JSON format (e.g., { taskId: '12345' })
    metadata: {
      type: "json",
      nullable: true, // can be null if there's no extra info
    },

    // Automatically set when the notification is created
    createdAt: {
      type: "timestamp with time zone",
      createDate: true,
    },

    // Timestamp when the user reads the notification
    readAt: {
      type: "timestamp with time zone",
      nullable: true, // null if not yet read
    },

    // Foreign key to link the notification to a user
    userId: {
      type: "uuid",
    },

    // Soft delete: set to true when the notification is deleted (not removed from DB)
    isDeleted: {
      type: "boolean",
      default: false,
    },
  },

  // Define relationships with other entities
  relations: {
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: {
        name: "userId",
      },
      inverseSide: "notifications",
      onDelete: "CASCADE",
    },
  },
});
