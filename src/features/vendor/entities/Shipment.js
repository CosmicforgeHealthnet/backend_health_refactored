const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Shipment",
    tableName: "shipments",
    columns: {
        id:      { primary: true, type: "uuid", generated: "uuid" },
        orderId: { type: "uuid", nullable: false, unique: true },
        vendorId:  { type: "uuid", nullable: false },
        patientId: { type: "uuid", nullable: false },

        status: {
            type: "enum",
            enum: ["pending", "dispatched", "in_transit", "delivered", "failed"],
            default: "pending",
        },

        deliveryMethod: {
            type: "enum",
            enum: ["pickup", "delivery"],
            nullable: false,
        },

        deliveryAddress:     { type: "text",    nullable: true },
        trackingNumber:      { type: "varchar", nullable: true },
        logisticsProvider:   { type: "varchar", nullable: true, comment: "e.g. DHL, GIG Logistics, Jumia" },
        estimatedDeliveryAt: { type: "timestamp", nullable: true },
        dispatchedAt:        { type: "timestamp", nullable: true },
        deliveredAt:         { type: "timestamp", nullable: true },
        vendorNotes:         { type: "text",    nullable: true },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        order: {
            type: "one-to-one",
            target: "VendorOrder",
            joinColumn: { name: "orderId" },
            onDelete: "CASCADE",
        },
    },
    indices: [
        { columns: ["orderId"] },
        { columns: ["vendorId"] },
        { columns: ["patientId"] },
        { columns: ["status"] },
        { columns: ["trackingNumber"] },
    ],
});
