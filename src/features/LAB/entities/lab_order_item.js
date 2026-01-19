// src/entities/LabOrderItem.js
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "LabOrderItem",
  tableName: "lab_order_items",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // Foreign Keys
    orderId: { type: "uuid", nullable: false },
    
    // Test Details
    testName: { type: "varchar", length: 255, nullable: false },
    testCode: { type: "varchar", length: 50, nullable: true }, // LAB-001, RAD-XR-001
    testCategory: { type: "varchar", length: 100, nullable: true }, // Blood Work, Imaging, etc.
    description: { type: "text", nullable: true },
    
    // Pricing
    unitPrice: { type: "decimal", precision: 10, scale: 2, nullable: false },
    quantity: { type: "int", default: 1 },
    totalPrice: { type: "decimal", precision: 10, scale: 2, nullable: false },
    
    // Test Specifications
    sampleType: { type: "varchar", length: 100, nullable: true }, // Blood, Urine, Tissue
    preparationInstructions: { type: "text", nullable: true }, // Fasting required, etc.
    estimatedDuration: { type: "varchar", length: 50, nullable: true }, // "2-4 hours", "1-2 days"
    
    // Results
    result: { type: "text", nullable: true },
    normalRange: { type: "varchar", length: 255, nullable: true },
    unit: { type: "varchar", length: 50, nullable: true },
    isAbnormal: { type: "boolean", default: false },
    
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true }
  },
  
  relations: {
    order: {
      type: "many-to-one",
      target: "LabOrder",
      joinColumn: { name: "orderId", referencedColumnName: "id" },
      nullable: false
    }
  },
  
  indices: [
    { columns: ["orderId"] },
    { columns: ["testCode"] },
    { columns: ["testCategory"] }
  ]
});