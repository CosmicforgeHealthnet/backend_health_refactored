// src/entities/prescription/Prescription.js
const { EntitySchema } = require("typeorm");

const PrescriptionStatus = {
  PENDING:             "pending",
  PATIENT_UPLOADED:    "patient_uploaded",
  PHARMACY_ASSIGNED:   "pharmacy_assigned",
  PHARMACY_PROCESSING: "pharmacy_processing",
  // Payment-driven statuses added for invoice lifecycle
  UNDER_REVIEW:        "under_review",     // Pharmacy reviewing before sending invoice
  AWAITING_PAYMENT:    "awaiting_payment", // Invoice sent, waiting for patient payment
  IN_PROGRESS:         "in_progress",      // Payment confirmed, being fulfilled
  READY_FOR_PICKUP:    "ready_for_pickup",
  READY_FOR_DELIVERY:  "ready_for_delivery",
  COMPLETED:           "completed",
  CANCELLED:           "cancelled",
};

const PaymentStatus = {
  UNPAID: "unpaid",
  PAID: "paid",
  CANCELLED: "cancelled"
};

const PaymentMethod = {
  ONLINE: "online",
  PAY_ON_PICKUP: "payOnPickup"
};

module.exports = new EntitySchema({
  name: "Prescription",
  tableName: "prescriptions",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    reference: {
      type: "varchar",
      unique: true,
      nullable: false,
      comment: "Prescription reference code (e.g., RX-20250821-001)"
    },

    // Foreign Keys
    doctorId: { type: "uuid", nullable: false },
    patientId: { type: "uuid", nullable: false },
    pharmacyId: { type: "uuid", nullable: true }, // Set when patient selects pharmacy
    consultationId: { type: "uuid", nullable: true }, // Link to consultation if applicable

    // Prescription Content
    medications: {
      type: "json",
      nullable: false,
      comment: "Array of prescribed medications with dosage, frequency, duration, route, notes, quantity"
    },
    diagnosis: { type: "text", nullable: true },
    doctorSignature: { type: "text", nullable: true, comment: "Base64 or URL of doctor's signature" },

    // Pharmacy Operations
    internalNotes: {
      type: "json",
      nullable: true,
      default: [],
      comment: "Array of internal notes for pharmacy staff: {note, pharmacistId, timestamp}"
    },
    availabilityStatus: {
      type: "enum",
      enum: ["pending", "confirmed", "unavailable", "alternatives_proposed"],
      default: "pending",
      nullable: false
    },

    // Status Tracking
    status: {
      type: "enum",
      enum: Object.values(PrescriptionStatus),
      default: PrescriptionStatus.PENDING,
      nullable: false
    },

    // Pharmacy Fulfillment Info  
    assignedPharmacistId: { type: "uuid", nullable: true },
    fulfillmentHistory: {
      type: "json",
      nullable: true,
      comment: "Array of status changes with timestamps"
    },

    // Invoice & Payment
    invoiceItems: {
      type: "json",
      nullable: true,
      comment: "Array of medication costs calculated by pharmacy"
    },
    currency: { type: "varchar", length: 3, nullable: true, comment: "Currency code (3 chars) used for this prescription" },
    deliveryFee: { type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 },
    totalDue: { type: "decimal", precision: 10, scale: 2, nullable: true },
    paymentMethod: {
      type: "enum",
      enum: Object.values(PaymentMethod),
      nullable: true
    },
    paymentStatus: {
      type: "enum",
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.UNPAID,
      nullable: false
    },

    // Communication
    chatMessages: {
      type: "json",
      nullable: true,
      comment: "Chat messages between patient and pharmacy"
    },

    // Additional Notes
    doctorNotes: { type: "text", nullable: true },
    pharmacyNotes: { type: "text", nullable: true },
    patientNotes: { type: "text", nullable: true },

    // Timestamps
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },

    // Delivery/Pickup Details
    deliveryAddress: { type: "text", nullable: true },
    deliveryInstructions: { type: "text", nullable: true },
    expectedDeliveryDate: { type: "timestamp", nullable: true },
    actualDeliveryDate: { type: "timestamp", nullable: true }
  },

  relations: {
    doctor: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "doctorId" },
      onDelete: "CASCADE"
    },
    patient: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "patientId" },
      onDelete: "CASCADE"
    },
    pharmacy: {
      type: "many-to-one",
      target: "PharmacyProfile",
      joinColumn: { name: "pharmacyId" },
      onDelete: "SET NULL"
    },
    assignedPharmacist: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "assignedPharmacistId" },
      onDelete: "SET NULL"
    }
  },

  indices: [
    { columns: ["doctorId"] },
    { columns: ["patientId"] },
    { columns: ["pharmacyId"] },
    { columns: ["reference"] },
    { columns: ["status"] },
    { columns: ["paymentStatus"] },
    { columns: ["createdAt"] },
    { columns: ["consultationId"] }
  ]
});

// Export enums for use in other files
module.exports.PrescriptionStatus = PrescriptionStatus;
module.exports.PaymentStatus = PaymentStatus;
module.exports.PaymentMethod = PaymentMethod;