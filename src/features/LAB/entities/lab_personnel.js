// src/entities/LabPersonnel.js
const { EntitySchema } = require("typeorm");
const { PERSONNEL_ROLE, PERSONNEL_STATUS } = require("../utils/constants");


module.exports = new EntitySchema({
  name: "LabPersonnel",
  tableName: "lab_personnel", 
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },

    facilityId: { type: "uuid", nullable: false },
    userId: { type: "uuid", nullable: true },
    invitedById: { type: "uuid", nullable: false },
    
    // Personnel Role
    role: {
      type: "enum",
      enum: Object.values(PERSONNEL_ROLE),
      nullable: false
    },
    
    status: {
      type: "enum",
      enum: Object.values(PERSONNEL_STATUS), 
      default: PERSONNEL_STATUS.PENDING_REGISTRATION
    },
    
    // Personnel Details (collected during invitation)
    fullName: { type: "varchar", length: 255, nullable: false },
    email: { type: "varchar", length: 255, nullable: false },
    phone: { type: "varchar", length: 20, nullable: true },
    
    // Professional Information
    licenseNumber: { type: "varchar", length: 100, nullable: true },
    specialization: { type: "varchar", length: 255, nullable: true },
    yearsOfExperience: { type: "int", nullable: true },
    qualifications: { type: "json", nullable: true },
    
    // Access Control
    permissions: { type: "json", nullable: true },
    departments: { type: "json", nullable: true },
    
    // Registration & Invitation Details
    registrationToken: { type: "varchar", length: 255, unique: true, nullable: true },
    tempPassword: { type: "varchar", length: 255, nullable: true }, // Temporary password for first login
    invitationSentAt: { type: "timestamp", nullable: true },
    tokenExpiresAt: { type: "timestamp", nullable: true },
    registeredAt: { type: "timestamp", nullable: true },
    
    // User Account Creation Status
    userAccountCreated: { type: "boolean", default: false },
    firstLoginCompleted: { type: "boolean", default: false },
    
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true }
  },
  
  
  relations: {
    facility: {
      type: "many-to-one",
      target: "LabFacility",
      joinColumn: { name: "facilityId", referencedColumnName: "id" },
      nullable: false
    },
    user: {
      type: "many-to-one",
      target: "User", 
      joinColumn: { name: "userId", referencedColumnName: "id" },
      nullable: true
    },
    invitedBy: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "invitedById", referencedColumnName: "id" },
      nullable: false
    }
  },
  
  indices: [
    { columns: ["email"] },
    { columns: ["role"] },
    { columns: ["status"] },
    { columns: ["facilityId", "role"] },
    { columns: ["registrationToken"] },
    { columns: ["userAccountCreated"] },
    { columns: ["userId"] },
    { columns: ["invitedById"] }
  ]
});