// src/entities/LabFacility.js
const { EntitySchema } = require("typeorm");
const { FACILITY_TYPES, FACILITY_STATUS } = require("../utils/constants");

module.exports = new EntitySchema({
  name: "LabFacility",
  tableName: "lab_facilities",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },

    // Basic Facility Information
    facilityName: { type: "varchar", length: 255, nullable: true },
    facilityType: {
      type: "enum",
      enum: Object.values(FACILITY_TYPES),
      nullable: true
    },
    registrationNumber: {
      type: "varchar",
      length: 100,
      unique: true,
      nullable: true
    },
    licenseNumber: { type: "varchar", length: 100, unique: true, nullable: true },

    // Contact Information
    email: { type: "varchar", length: 255, unique: true, nullable: true },
    phone: { type: "varchar", length: 20, nullable: true },
    website: { type: "varchar", length: 255, nullable: true },

    // Address Information
    address: { type: "text", nullable: true },
    city: { type: "varchar", length: 100, nullable: true },
    state: { type: "varchar", length: 100, nullable: true },
    country: { type: "varchar", length: 100, nullable: true },
    postalCode: { type: "varchar", length: 20, nullable: true },

    // Lab Admin Information (person registering the facility)
    adminFullName: { type: "varchar", length: 255, nullable: false },
    adminEmail: { type: "varchar", length: 255, nullable: false },
    adminPhone: { type: "varchar", length: 20, nullable: true },

    // Operational Details
    operatingHours: { type: "json", nullable: true },
    servicesOffered: { type: "json", nullable: true },
    equipmentList: { type: "json", nullable: true },

    // Status and Approval
    status: {
      type: "enum",
      enum: Object.values(FACILITY_STATUS),
      default: FACILITY_STATUS.PENDING_APPROVAL,
    },

    // Documents
    licenseDocument: { type: "varchar", length: 500, nullable: true },
    registrationDocument: { type: "varchar", length: 500, nullable: true },
    accreditationDocument: { type: "varchar", length: 500, nullable: true },

    // Admin fields
    approvedAt: { type: "timestamp", nullable: true },
    rejectedAt: { type: "timestamp", nullable: true },
    rejectionReason: { type: "text", nullable: true },

    // User Account Creation
    adminUserCreated: { type: "boolean", default: false },
    adminInvitationSent: { type: "boolean", default: false },

    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },

    registrationStep: {
      type: "int",
      default: 1,
      comment: "Current registration step (1-3)",
    },
    registrationCompleted: {
      type: "boolean",
      default: false,
    },
  },

  relations: {
    // This will be set after user account is created
    adminUser: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "adminUserId" },
      onDelete: "CASCADE",
      nullable: true,
    },
    approvedBy: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "approvedById" },
      nullable: true,
      onDelete: "SET NULL",
    },
    personnel: {
      type: "one-to-many",
      target: "LabPersonnel",
      inverseSide: "facility",
    },
  },

  indices: [
    { columns: ["facilityName"] },
    { columns: ["status"] },
    { columns: ["facilityType"] },
    { columns: ["city", "state"] },
    { columns: ["adminEmail"] },
    { columns: ["createdAt"] },
  ],
});
