const { EntitySchema } = require("typeorm");

const VENDOR_CATEGORIES = [
    "health_wellness",
    "medical_supplies",
    "baby_mother_care",
    "fitness_lifestyle",
    "nutrition_healthy_living",
    "others",
];

module.exports = new EntitySchema({
    name: "VendorProfile",
    tableName: "vendor_profiles",
    columns: {
        id: { primary: true, type: "uuid", generated: "uuid" },
        userId: { type: "uuid", nullable: false },

        businessName: { type: "varchar", nullable: false },
        businessCategory: {
            type: "enum",
            enum: VENDOR_CATEGORIES,
            nullable: false,
        },
        businessEmail: { type: "varchar", nullable: false },
        businessPhone: { type: "varchar", nullable: false },

        country: { type: "varchar", length: 100, nullable: false },
        state:   { type: "varchar", length: 100, nullable: false },
        city:    { type: "varchar", length: 100, nullable: false },
        fullAddress: { type: "text", nullable: false },

        businessWebsite:    { type: "varchar", nullable: true },
        businessDescription: { type: "text", nullable: false },

        logoUrl: { type: "varchar", nullable: true },

        // Geolocation — used by /api/patient/nearby-vendors/
        latitude: { type: "decimal", precision: 10, scale: 7, nullable: true },
        longitude: { type: "decimal", precision: 10, scale: 7, nullable: true },
        deliveryAvailable: { type: "boolean", default: true },
        pickupAvailable: { type: "boolean", default: true },

        verificationStatus: {
            type: "enum",
            enum: ["pending", "documents_required", "under_review", "approved", "rejected", "suspended"],
            default: "pending",
        },
        isActive:           { type: "boolean", default: false },
        documentsSubmitted: { type: "boolean", default: false },

        // Set to true when a pharmacy also registers as a vendor
        isHybridPharmacy:   { type: "boolean", default: false },
        pharmacyProfileId:  { type: "uuid", nullable: true, comment: "Linked PharmacyProfile if hybrid" },

        notificationPreferences: { type: "json", nullable: true },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        user: {
            type: "one-to-one",
            target: "User",
            joinColumn: { name: "userId" },
            onDelete: "CASCADE",
        },
        documents: {
            type: "one-to-many",
            target: "VendorDocument",
            inverseSide: "vendor",
            cascade: true,
        },
        verificationRequests: {
            type: "one-to-many",
            target: "VendorVerificationRequest",
            inverseSide: "vendor",
            cascade: true,
        },
        products: {
            type: "one-to-many",
            target: "Product",
            inverseSide: "vendor",
            cascade: true,
        },
    },
    indices: [
        { columns: ["userId"] },
        { columns: ["verificationStatus"] },
        { columns: ["businessCategory"] },
        { columns: ["isHybridPharmacy"] },
    ],
});
