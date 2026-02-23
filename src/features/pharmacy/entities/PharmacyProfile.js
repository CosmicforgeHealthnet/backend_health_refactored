// src/entities/pharmacy/PharmacyProfile.js
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "PharmacyProfile",
  tableName: "pharmacy_profiles",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    userId: { type: "uuid", nullable: false },

    // Form 1 fields
    pharmacyName: { type: "varchar", nullable: false },
    registrationNumber: { type: "varchar", unique: true, nullable: false },
    address: { type: "text", nullable: false },
    phone: { type: "varchar", nullable: false },
    primaryContactPerson: { type: "varchar", nullable: false },
    email: { type: "varchar", nullable: false },
    preferredUsername: { type: "varchar", unique: true, nullable: false },

    // Additional fields
    licenseNumber: { type: "varchar", unique: true, nullable: true },
    licenseExpiryDate: { type: "date", nullable: true },
    operatingHours: { type: "json", nullable: true },
    description: { type: "text", nullable: true },
    website: { type: "varchar", nullable: true },

    // Settings & Operational Details
    defaultCurrency: { type: "varchar", length: 3, default: "NGN", nullable: false },
    serviceRadius: { type: "decimal", precision: 10, scale: 2, default: 0, nullable: false, comment: "Delivery radius in miles/km" },
    notificationPreferences: {
      type: "json",
      nullable: true,
      comment: "Notification toggles"
    },

    // Status tracking
    verificationStatus: {
      type: "enum",
      enum: ["pending", "documents_required", "under_review", "approved", "rejected", "suspended"],
      default: "pending"
    },
    isActive: { type: "boolean", default: false },

    documentsSubmitted: { type: "boolean", default: false },

    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
  },
  relations: {
    user: {
      type: "one-to-one",
      target: "User",
      joinColumn: { name: "userId" },
      onDelete: "CASCADE",
    },
    documents: {
      type: "one-to-many",
      target: "PharmacyDocument",
      inverseSide: "pharmacy",
      cascade: true,
    },
    branches: {
      type: "one-to-many",
      target: "PharmacyBranch",
      inverseSide: "pharmacy",
      cascade: true,
    },
    staffMembers: {
      type: "one-to-many",
      target: "User",
      inverseSide: "staffPharmacy",
      cascade: true,
    },
  },
  indices: [
    { columns: ["userId"] },
    { columns: ["registrationNumber"] },
    { columns: ["preferredUsername"] },
    { columns: ["verificationStatus"] },
  ],
});