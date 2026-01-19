// src/entities/pharmacy/PharmacyBranch.js
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "PharmacyBranch",
  tableName: "pharmacy_branches",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    pharmacyId: { type: "uuid", nullable: false },
    managerId: { type: "uuid", nullable: true },
    
    branchName: { type: "varchar", nullable: false },
    address: { type: "text", nullable: false },
    phone: { type: "varchar", nullable: false },
    email: { type: "varchar", nullable: true },
    licenseNumber: { type: "varchar", unique: true, nullable: false },
    
    // Branch specific settings
    operatingHours: { type: "json", nullable: true },
    servicesOffered: { type: "json", nullable: true },
    isMainBranch: { type: "boolean", default: false },
    isActive: { type: "boolean", default: true },
    
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
  },
  relations: {
    pharmacy: {
      type: "many-to-one",
      target: "PharmacyProfile",
      joinColumn: { name: "pharmacyId" },
      onDelete: "CASCADE",
    },
    manager: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "managerId" },
    },
  },
  indices: [
    { columns: ["pharmacyId"] },
    { columns: ["managerId"] },
    { columns: ["licenseNumber"] },
    { columns: ["isMainBranch"] },
  ],
});