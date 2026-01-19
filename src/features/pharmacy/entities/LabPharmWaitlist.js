// src/entities/LabWaitlist.js
const { EntitySchema } = require("typeorm");

const WAITLIST_STATUS = {
  PENDING: "pending",
  CONTACTED: "contacted", 
  REGISTERED: "registered",
  DECLINED: "declined"
};

const role = {
  LAB: "lab",
  PHARMACY: "pharmarcy"
}

module.exports = new EntitySchema({
  name: "LabPharmWaitlist",
  tableName: "lab_pharm_waitlist",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // Basic Information
    fullName: { 
      type: "varchar", 
      length: 255, 
      nullable: false 
    },
    email: { 
      type: "varchar", 
      length: 255, 
      nullable: false,
      unique: true 
    },
    facilityName: { 
      type: "varchar", 
      length: 255, 
      nullable: false 
    },

    role: {
      type: "enum",
      enum: Object.values(role),
      nullable: false
    },
    
    // Optional fields
    phone: { 
      type: "varchar", 
      length: 20, 
      nullable: true 
    },
    facilityType: {
      type: "varchar",
      length: 100,
      nullable: true
    },
    city: {
      type: "varchar",
      length: 100,
      nullable: true
    },
    state: {
      type: "varchar",
      length: 100,
      nullable: true
    },
    
    // Status tracking
    status: {
      type: "enum",
      enum: Object.values(WAITLIST_STATUS),
      default: WAITLIST_STATUS.PENDING
    },
    
    // Communication tracking
    emailSent: { 
      type: "boolean", 
      default: false 
    },
    emailSentAt: { 
      type: "timestamp", 
      nullable: true 
    },
    
    // Admin notes
    adminNotes: { 
      type: "text", 
      nullable: true 
    },
    
    // Launch notification
    launchNotificationSent: {
      type: "boolean",
      default: false
    },
    launchNotificationSentAt: {
      type: "timestamp",
      nullable: true
    },
    
    // Timestamps
    createdAt: { 
      type: "timestamp", 
      createDate: true 
    },
    updatedAt: { 
      type: "timestamp", 
      updateDate: true 
    },
  },

  indices: [
    { columns: ["email"] },
    { columns: ["status"] },
    { columns: ["createdAt"] },
    { columns: ["facilityName"] },
    { columns: ["city", "state"] },
  ],
});

module.exports.WAITLIST_STATUS = WAITLIST_STATUS;