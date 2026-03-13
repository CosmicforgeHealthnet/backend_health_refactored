const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "InvoiceLineItem",
  tableName: "invoice_line_items",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },

    invoiceId: { type: "uuid", nullable: false },

    medicationName: { type: "varchar", length: 255, nullable: false },
    dosage:         { type: "varchar", length: 100, nullable: true },
    quantity:       { type: "int", nullable: false },

    // Stored in USD
    unitPriceUsd:   { type: "decimal", precision: 14, scale: 4, nullable: false },
    subtotalUsd:    { type: "decimal", precision: 14, scale: 4, nullable: false },

    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    invoice: {
      type: "many-to-one",
      target: "Invoice",
      joinColumn: { name: "invoiceId" },
      onDelete: "CASCADE",
      inverseSide: "lineItems",
    },
  },
  indices: [
    { columns: ["invoiceId"] },
  ],
});
