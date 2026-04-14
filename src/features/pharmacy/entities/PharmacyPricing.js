const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "PharmacyPricing",
    tableName: "pharmacy_pricing",
    columns: {
        id: { primary: true, type: "uuid", generated: "uuid" },
        pharmacyId: { type: "uuid", nullable: false },
        feeType: {
            type: "varchar",
            length: 100,
            nullable: false
        },
        price: { type: "decimal", precision: 10, scale: 2, nullable: false },
        currency: { type: "varchar", length: 3, default: "NGN", nullable: false },
        isActive: { type: "boolean", default: true },
        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true }
    },
    relations: {
        pharmacy: {
            type: "many-to-one",
            target: "PharmacyProfile",
            joinColumn: { name: "pharmacyId" },
            onDelete: "CASCADE"
        }
    },
    indices: [
        { columns: ["pharmacyId"] },
        { columns: ["feeType"] },
        { columns: ["isActive"] }
    ]
});
