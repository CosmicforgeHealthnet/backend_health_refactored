const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "VendorOrder",
    tableName: "vendor_orders",
    columns: {
        id:          { primary: true, type: "uuid", generated: "uuid" },
        orderNumber: { type: "varchar", length: 50, nullable: false, unique: true },

        cartId:    { type: "uuid", nullable: false, unique: true },
        vendorId:  { type: "uuid", nullable: false },
        patientId: { type: "uuid", nullable: false },

        status: {
            type: "enum",
            enum: ["pending", "processing", "completed", "cancelled"],
            default: "pending",
        },

        paymentStatus: {
            type: "enum",
            enum: ["unpaid", "paid", "refunded"],
            default: "unpaid",
        },

        // subtotal = vendor's base price (e.g. ₦10,000)
        subtotal:          { type: "decimal", precision: 14, scale: 4, nullable: false },
        // platformFeeAmount = 7% added ON TOP for customer (e.g. ₦700)
        platformFeeAmount: { type: "decimal", precision: 14, scale: 4, nullable: false },
        // grossAmount = what customer actually pays = subtotal + platformFeeAmount (e.g. ₦10,700)
        grossAmount:       { type: "decimal", precision: 14, scale: 4, nullable: false },
        // commissionRate = vendor commission rate (0–1). TBD — currently 0
        commissionRate:    { type: "decimal", precision: 5,  scale: 4, nullable: false, default: 0 },
        // commissionAmount = subtotal * commissionRate (e.g. ₦0 until rate confirmed)
        commissionAmount:  { type: "decimal", precision: 14, scale: 4, nullable: false, default: 0 },
        // vendorAmount = subtotal - commissionAmount (what vendor earns)
        vendorAmount:      { type: "decimal", precision: 14, scale: 4, nullable: false },
        currency:          { type: "varchar", length: 10, default: "NGN" },

        paymentReference: { type: "varchar", nullable: true },
        paymentProvider:  { type: "varchar", nullable: true },
        paymentAuthUrl:   { type: "varchar", nullable: true },

        patientNote:     { type: "text", nullable: true },
        vendorNote:      { type: "text", nullable: true },
        deliveryMethod:  { type: "varchar", length: 20, nullable: true, comment: "pickup or delivery" },
        deliveryAddress: { type: "text", nullable: true },

        cancelledBy: { type: "varchar", length: 20, nullable: true },
        cancelledAt: { type: "timestamp", nullable: true },
        completedAt: { type: "timestamp", nullable: true },
        paidAt:      { type: "timestamp", nullable: true },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        vendor: {
            type: "many-to-one",
            target: "VendorProfile",
            joinColumn: { name: "vendorId" },
            onDelete: "RESTRICT",
        },
        patient: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "patientId" },
            onDelete: "RESTRICT",
        },
    },
    indices: [
        { columns: ["vendorId"] },
        { columns: ["patientId"] },
        { columns: ["cartId"] },
        { columns: ["status"] },
        { columns: ["paymentStatus"] },
        { columns: ["orderNumber"] },
        { columns: ["createdAt"] },
    ],
});
