const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "PrescriptionCartItem",
    tableName: "prescription_cart_items",
    columns: {
        id:     { primary: true, type: "uuid", generated: "uuid" },
        cartId: { type: "uuid", nullable: false },

        productName:    { type: "varchar",      nullable: false, comment: "Medication or item name" },
        quantity:       { type: "int",          nullable: false, default: 1 },
        unitPriceNgn:   { type: "decimal", precision: 14, scale: 4, nullable: false },
        totalPriceNgn:  { type: "decimal", precision: 14, scale: 4, nullable: false },

        note:          { type: "text",    nullable: true, comment: "e.g. substituted with generic" },
        isSubstitute:  { type: "boolean", nullable: false, default: false },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        cart: {
            type: "many-to-one",
            target: "PrescriptionCart",
            joinColumn: { name: "cartId" },
            onDelete: "CASCADE",
            inverseSide: "items",
        },
    },
    indices: [
        { columns: ["cartId"] },
    ],
});
