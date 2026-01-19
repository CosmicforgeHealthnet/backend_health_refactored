// src/entities/LabOrder.js
const { EntitySchema } = require("typeorm");
const { ORDER_TYPE, SERVICE_TYPE,ORDER_STATUS, PAYMENT_STATUS } = require("../utils/constants");



module.exports = new EntitySchema({
  name: "LabOrder",
  tableName: "lab_orders",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    orderNumber: { type: "varchar", length: 20, unique: true }, // AUTO-generated: ORD-2024-001234
    
    // Foreign Keys (explicit)
    patientId: { type: "uuid", nullable: false },
    facilityId: { type: "uuid", nullable: false },
    assignedPersonnelId: { type: "uuid", nullable: true },
    reviewerId: { type: "uuid", nullable: true },
    
    // Order Classification
    orderType: {
      type: "enum",
      enum: Object.values(ORDER_TYPE),
      nullable: false
    },
    serviceType: {
      type: "enum",
      enum: Object.values(SERVICE_TYPE),
      default: SERVICE_TYPE.LAB_VISIT
    },
    
    // Order Status Tracking
    status: {
      type: "enum",
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.CREATED
    },
    
    // Test Information
    testNames: { type: "json", nullable: false }, // ["Blood Test", "Urine Analysis"]
    testDetails: { type: "json", nullable: true }, // Detailed test specifications
    urgentProcessing: { type: "boolean", default: false },
    
    // Patient Information
    patientInstructions: { type: "text", nullable: true }, // Special preparation instructions
    doctorReferral: { type: "varchar", length: 500, nullable: true }, // Doctor's prescription/referral
    medicalHistory: { type: "text", nullable: true }, // Relevant medical history
    
    // Appointment/Collection Details
    preferredDate: { type: "date", nullable: true },
    preferredTime: { type: "varchar", length: 20, nullable: true },
    scheduledDateTime: { type: "timestamp", nullable: true },
    collectionAddress: { type: "text", nullable: true }, // For home collection
    
    // Payment Information
    paymentStatus: {
      type: "enum",
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING
    },
    
    totalAmount: { type: "decimal", precision: 10, scale: 2, nullable: true },
    baseAmount: { type: "decimal", precision: 10, scale: 2, nullable: true },
    homeVisitFee: { type: "decimal", precision: 10, scale: 2, nullable: true },
    urgentFee: { type: "decimal", precision: 10, scale: 2, nullable: true },
    currency: { type: "varchar", length: 3, default: "USD" },
    invoiceSentAt: { type: "timestamp", nullable: true },
    paidAt: { type: "timestamp", nullable: true },
    
    // Results Information
    resultsFileUrl: { type: "varchar", length: 500, nullable: true },
    resultsData: { type: "json", nullable: true }, // Structured test results
    reviewerNotes: { type: "text", nullable: true },
    resultsDeliveredAt: { type: "timestamp", nullable: true },
    
    // Workflow Timestamps
    assignedAt: { type: "timestamp", nullable: true },
    collectionCompletedAt: { type: "timestamp", nullable: true },
    processingStartedAt: { type: "timestamp", nullable: true },
    processingCompletedAt: { type: "timestamp", nullable: true },
    reviewStartedAt: { type: "timestamp", nullable: true },
    reviewCompletedAt: { type: "timestamp", nullable: true },
    
    // Additional Information
    notes: { type: "text", nullable: true }, // Internal notes
    cancellationReason: { type: "text", nullable: true },
    
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true }
  },
  
  relations: {
    patient: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "patientId", referencedColumnName: "id" },
      nullable: false
    },
    facility: {
      type: "many-to-one",
      target: "LabFacility",
      joinColumn: { name: "facilityId", referencedColumnName: "id" },
      nullable: false
    },
    assignedPersonnel: {
      type: "many-to-one",
      target: "LabPersonnel",
      joinColumn: { name: "assignedPersonnelId", referencedColumnName: "id" },
      nullable: true
    },
    reviewer: {
      type: "many-to-one",
      target: "LabPersonnel",
      joinColumn: { name: "reviewerId", referencedColumnName: "id" },
      nullable: true
    },
    orderItems: {
      type: "one-to-many",
      target: "LabOrderItem",
      inverseSide: "order"
    },
    chatRoom: {
      type: "one-to-one",
      target: "ChatRoom",
      inverseSide: "labOrder"
    }
  },
  
  indices: [
    { columns: ["orderNumber"] },
    { columns: ["patientId"] },
    { columns: ["facilityId"] },
    { columns: ["status"] },
    { columns: ["orderType"] },
    { columns: ["serviceType"] },
    { columns: ["paymentStatus"] },
    { columns: ["assignedPersonnelId"] },
    { columns: ["reviewerId"] },
    { columns: ["createdAt"] },
    { columns: ["scheduledDateTime"] },
    { columns: ["facilityId", "status"] },
    { columns: ["patientId", "status"] }
  ]
});