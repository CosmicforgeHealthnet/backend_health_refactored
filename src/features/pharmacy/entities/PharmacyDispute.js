const { EntitySchema } = require("typeorm");

const DisputeStatus = {
  OPEN:         "open",
  UNDER_REVIEW: "under_review",
  RESOLVED:     "resolved",
  ESCALATED:    "escalated",
  CLOSED:       "closed",
};

const DisputeResolution = {
  PHARMACY_FAVOUR: "pharmacy_favour",
  PATIENT_FAVOUR:  "patient_favour",
  SPLIT:           "split",
  PENDING:         "pending",
};

const RaisedBy = {
  PATIENT:  "patient",
  PHARMACY: "pharmacy",
};

const DisputeSchema = new EntitySchema({
  name: "PharmacyDispute",
  tableName: "pharmacy_disputes",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },

    invoiceId:  { type: "uuid", nullable: false },
    pharmacyId: { type: "uuid", nullable: false },
    patientId:  { type: "uuid", nullable: false },

    // Snapshot of invoice amount at dispute time (USD)
    amountUsd: { type: "decimal", precision: 14, scale: 4, nullable: false },

    status: {
      type: "enum",
      enum: Object.values(DisputeStatus),
      default: DisputeStatus.OPEN,
      nullable: false,
    },
    resolution: {
      type: "enum",
      enum: Object.values(DisputeResolution),
      default: DisputeResolution.PENDING,
      nullable: true,
    },

    reason:      { type: "varchar", length: 255, nullable: false },
    description: { type: "text", nullable: false },
    raisedBy: {
      type: "enum",
      enum: Object.values(RaisedBy),
      nullable: false,
    },

    // Pharmacy response
    pharmacyResponse:   { type: "text", nullable: true },
    pharmacyResponseAt: { type: "timestamp", nullable: true },

    resolvedAt: { type: "timestamp", nullable: true },
    createdAt:  { type: "timestamp", createDate: true },
    updatedAt:  { type: "timestamp", updateDate: true },
  },
  relations: {
    invoice: {
      type: "many-to-one",
      target: "Invoice",
      joinColumn: { name: "invoiceId" },
      onDelete: "CASCADE",
    },
  },
  indices: [
    { columns: ["invoiceId"] },
    { columns: ["pharmacyId"] },
    { columns: ["patientId"] },
    { columns: ["status"] },
    { columns: ["createdAt"] },
  ],
});

DisputeSchema.DisputeStatus = DisputeStatus;
DisputeSchema.DisputeResolution = DisputeResolution;
DisputeSchema.RaisedBy = RaisedBy;

module.exports = DisputeSchema;
