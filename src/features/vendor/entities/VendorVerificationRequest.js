const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "VendorVerificationRequest",
    tableName: "vendor_verification_requests",
    columns: {
        id: { primary: true, type: "uuid", generated: "uuid" },
        vendorId: { type: "uuid", nullable: false },

        requestType: {
            type: "enum",
            enum: ["initial_verification", "re_verification", "document_update"],
            default: "initial_verification",
        },
        status: {
            type: "enum",
            enum: ["pending", "in_progress", "approved", "rejected", "requires_changes"],
            default: "pending",
        },
        priority: {
            type: "enum",
            enum: ["low", "medium", "high", "urgent"],
            default: "medium",
        },

        requestNotes:    { type: "text", nullable: true },
        rejectionReason: { type: "text", nullable: true },
        reviewNotes:     { type: "text", nullable: true },

        assignedTo: { type: "uuid", nullable: true, comment: "Admin user assigned to review" },
        reviewedBy: { type: "uuid", nullable: true, comment: "Admin user who completed review" },

        submittedAt: { type: "timestamp", nullable: true },
        assignedAt:  { type: "timestamp", nullable: true },
        reviewedAt:  { type: "timestamp", nullable: true },
        completedAt: { type: "timestamp", nullable: true },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        vendor: {
            type: "many-to-one",
            target: "VendorProfile",
            joinColumn: { name: "vendorId" },
            onDelete: "CASCADE",
            inverseSide: "verificationRequests",
        },
        assignedAdmin: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "assignedTo" },
        },
        reviewer: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "reviewedBy" },
        },
    },
    indices: [
        { columns: ["vendorId"] },
        { columns: ["status"] },
        { columns: ["priority"] },
        { columns: ["assignedTo"] },
    ],
});
